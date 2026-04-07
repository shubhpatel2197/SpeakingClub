/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import { io, Socket } from "socket.io-client";
import { useSnackbar } from "../context/SnackbarProvider";
import { useRouter } from "next/navigation";
import { useAuthContext } from "../context/AuthProvider";
import { getAuthToken } from "../lib/authToken";

type SendTransport = ReturnType<Device["createSendTransport"]>;
type RecvTransport = ReturnType<Device["createRecvTransport"]>;
type Producer = any;
type Consumer = any;

type Participant = {
  id: string;
  peerId?: string;
  userId?: string;
  name?: string | null;
  avatar?: string | null;
  muted?: boolean;
};

export function useMediasoup() {
  const { showSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const router = useRouter();

  const socketRef = useRef<Socket | null>(null);
  const externalSocketRef = useRef<boolean>(false);
  // Listeners registered by joinRoom on the (possibly shared) signalling socket.
  // Tracked so cleanupAll can detach them without disconnecting a shared socket.
  const joinRoomListenersRef = useRef<Array<{ event: string; fn: (...args: any[]) => void }>>([]);
  const dataConsumersByProducerIdRef = useRef<Record<string, any>>({});
  const myPeerIdRef = useRef<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<SendTransport | null>(null);
  const recvTransportRef = useRef<RecvTransport | null>(null);
  const producersRef = useRef<Record<string, Producer>>({});
  const consumersRef = useRef<Record<string, Consumer>>({});
  const consumersByProducerIdRef = useRef<Record<string, Consumer>>({});
  const audioElsRef = useRef<Record<string, HTMLAudioElement>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  // Screen-share refs/state
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoProducerRef = useRef<Producer | null>(null);
  const screenAudioProducerRef = useRef<Producer | null>(null);
  const screenVideoProducerIdRef = useRef<string | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenSharerId, setScreenSharerId] = useState<string | null>(null);
  const [screenSharerName, setScreenSharerName] = useState<string | null>(null);
  const needConsumeScreenRef = useRef<boolean>(false);

  // People / chat
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [producing, setProducing] = useState(false);
  const peersRef = useRef<Record<string, Participant>>({});

  type DataProducer = any;
  type DataConsumer = any;
  type ChatMessage = { id: string; from: string; text: string; ts: number };

  const dataProducerRef = useRef<DataProducer | null>(null);
  // Silent audio producer used on Safari to force the SendTransport's
  // DTLS/ICE handshake to complete. Without a media producer, Safari
  // often never opens the SCTP DataChannel, so produceData() resolves
  // but dp.send() silently drops messages.
  const silentAudioCtxRef = useRef<AudioContext | null>(null);
  const silentAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const silentAudioProducerRef = useRef<Producer | null>(null);
  // Outgoing data-channel messages queued until the DataProducer reaches
  // readyState 'open'. Safari often has a noticeable delay before the
  // underlying SCTP/DataChannel opens, during which dp.send() is a no-op
  // (or throws), causing messages to be silently dropped.
  const pendingOutgoingRef = useRef<string[]>([]);
  const dataConsumersRef = useRef<Record<string, DataConsumer>>({});
  const pendingDataProducersRef = useRef<
    Array<{ id: string; producerPeerId?: string }>
  >([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const typingRef = useRef<Record<string, boolean>>({});
  const lastTypingSentRef = useRef<number>(0);

  // Remote producers buffered until device is ready
  const pendingProducersRef = useRef<
    Array<{
      id: string;
      producerPeerId?: string;
      userId?: string;
      name?: string;
      muted?: boolean;
    }>
  >([]);

  const currentRoomIdRef = useRef<string>("");

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isFirefox = /Firefox\/\d+/.test(ua);
  const isChromium = /\b(Edg|Chrome|Chromium)\b/i.test(ua) && !isIOS;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

  function emitPresence() {
    const list = Object.values(peersRef.current);
    setParticipants(list);
  }

  const appendMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-49), m]);
  }, []);

  const parseIncomingDataPayload = useCallback(async (data: unknown) => {
    if (typeof data === "string") {
      return JSON.parse(data);
    }
    if (data instanceof Blob) {
      return JSON.parse(await data.text());
    }
    if (data instanceof ArrayBuffer) {
      return JSON.parse(new TextDecoder().decode(data));
    }
    if (ArrayBuffer.isView(data)) {
      return JSON.parse(
        new TextDecoder().decode(
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        )
      );
    }
    return null;
  }, []);

  const flushPendingOutgoing = useCallback(() => {
    const dp = dataProducerRef.current;
    if (!dp) return;
    const ch: any = (dp as any)._channel || (dp as any).channel || null;
    const rs = ch?.readyState || (dp as any).readyState;
    if (rs && rs !== "open") return;
    const queue = pendingOutgoingRef.current;
    while (queue.length) {
      const payload = queue.shift()!;
      try {
        dp.send(payload);
      } catch (e) {
        // Put back and bail — will retry on next open/interval.
        queue.unshift(payload);
        console.warn("[CL] dp.send failed; re-queued", e);
        return;
      }
    }
  }, []);

  const createDataProducerIfNeeded = useCallback(async () => {
    if (!sendTransportRef.current || dataProducerRef.current) return;
    const dp = await (sendTransportRef.current as any).produceData({
      ordered: true,
      label: "chat",
      protocol: "json",
    });
    dataProducerRef.current = dp;

    // Wire open/error listeners so queued messages are flushed once the
    // underlying SCTP DataChannel is actually usable. On Safari this can
    // take noticeably longer than on Chromium.
    try {
      (dp as any).on?.("open", () => flushPendingOutgoing());
    } catch {}
    const ch: any = (dp as any)._channel || (dp as any).channel || null;
    if (ch) {
      try {
        ch.addEventListener?.("open", () => flushPendingOutgoing());
      } catch {}
    }
    // Kick once in case it's already open by the time we wired listeners.
    flushPendingOutgoing();
  }, [flushPendingOutgoing]);

  /** Attach a track to the center "stage" <video id="screen-stage" /> */
  const attachToScreenStage = useCallback((track: MediaStreamTrack | null) => {
    const el = document.getElementById(
      "screen-stage"
    ) as HTMLVideoElement | null;
    if (!el) return;

    if (!track) {
      try {
        const ms = el.srcObject as MediaStream | null;
        if (ms) ms.getTracks().forEach((t) => t.stop());
      } catch {}
      el.srcObject = null;
      return;
    }

    const ms = new MediaStream();
    ms.addTrack(track);
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.srcObject = ms as any;

    const tryPlay = () => el.play().catch(() => {});
    tryPlay();
    setTimeout(tryPlay, 50);
  }, []);

  /** Choose a concrete codec to avoid UnsupportedError */
  function pickPreferredVideoCodec(device: Device | null) {
    if (!device) return undefined;
    const caps: any = (device as any).rtpCapabilities;
    if (!caps?.codecs) return undefined;

    const find = (mime: string) =>
      caps.codecs.find((c: any) => String(c.mimeType).toLowerCase() === mime);

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const h264 = find("video/h264");
    const vp8 = find("video/vp8");

    if (isSafari && h264) return h264;
    if (vp8) return vp8;
    if (h264) return h264;
    return caps.codecs.find((c: any) => c.kind === "video");
  }

  function pickScreenshareCodec(device: Device | null) {
    if (!device) return undefined;
    const caps: any = (device as any).rtpCapabilities;
    const find = (mime: string) =>
      caps?.codecs?.find((c: any) => String(c.mimeType).toLowerCase() === mime);

    const vp9 = find("video/vp9");
    const h264 = find("video/h264");
    const vp8 = find("video/vp8");

    return (
      vp9 || h264 || vp8 || caps?.codecs?.find((c: any) => c.kind === "video")
    );
  }

  /** DataChannel consumer */
  const consumeDataProducer = useCallback(
    async (socket: Socket, dataProducerId: string) => {
      // Avoid double-consuming the same data producer (prevents duplicate chat messages).
      if (dataConsumersByProducerIdRef.current[dataProducerId]) return;
      if (!recvTransportRef.current) {
        const tpParams = await new Promise<any>((resolve, reject) => {
          socket.emit(
            "createWebRtcTransport",
            {
              roomId: currentRoomIdRef.current,
              direction: "recv",
              enableSctp: true,
            },
            (res: any) => (res?.error ? reject(res.error) : resolve(res))
          );
        });
        if (!deviceRef.current) return;
        const recvTransport: RecvTransport = (
          deviceRef.current as any
        ).createRecvTransport(tpParams);
        recvTransportRef.current = recvTransport;
        recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socket.emit(
            "connectTransport",
            { transportId: recvTransport.id, dtlsParameters },
            (res: any) => (res?.error ? errback(res.error) : callback())
          );
        });
      }

      const params = await new Promise<any>((resolve, reject) => {
        socket.emit(
          "consumeData",
          { roomId: currentRoomIdRef.current, dataProducerId },
          (res: any) => (res?.error ? reject(res.error) : resolve(res))
        );
      });

      const dataConsumer: DataConsumer = await (
        recvTransportRef.current as any
      ).consumeData({
        id: params.id,
        dataProducerId: params.dataProducerId,
        sctpStreamParameters: params.sctpStreamParameters,
        label: params.label,
        protocol: params.protocol,
      });

      dataConsumersRef.current[dataConsumer.id] = dataConsumer;
      dataConsumersByProducerIdRef.current[params.dataProducerId] = dataConsumer;
      (dataConsumer as any).on("message", async (data: unknown) => {
        try {
          const m = await parseIncomingDataPayload(data);
          if (!m) return;
          if (m.t === "chat")
            appendMessage({ id: m.id, from: m.from, text: m.text, ts: m.ts });
          else if (m.t === "typing" && m.from)
            typingRef.current[m.from] = !!m.on;
        } catch {}
      });

      socket.emit("dataConsumerResume", { dataConsumerId: dataConsumer.id });
    },
    [appendMessage, parseIncomingDataPayload]
  );

  /** Attach remote audio / detect screen video */
  const attachConsumerTrack = useCallback(
    (consumer: Consumer, key: string) => {
      try {
        if ((consumer as any).kind === "video") {
          const isScreen =
            screenVideoProducerIdRef.current &&
            key === screenVideoProducerIdRef.current;
          if (isScreen) {
            attachToScreenStage(consumer.track);
          }
          return;
        }

        // Remote audio
        const ms = new MediaStream();
        ms.addTrack(consumer.track);

        let audio = audioElsRef.current[key];
        if (!audio) {
          audio = document.createElement("audio");
          audio.setAttribute("playsinline", "");
          audio.autoplay = true;
          audio.controls = false;
          audio.volume = 1;
          (
            document.getElementById("remote-audio-container") ?? document.body
          ).appendChild(audio);
          audioElsRef.current[key] = audio;
        }
        // @ts-ignore
        audio.srcObject = ms;

        audio.play().catch(() => {
          const btn = document.createElement("button");
          btn.textContent = "Enable audio";
          Object.assign(btn.style, {
            position: "fixed",
            right: "16px",
            bottom: "16px",
            zIndex: "9999",
            padding: "8px 12px",
            borderRadius: "8px",
            cursor: "pointer",
          });
          btn.onclick = async () => {
            try {
              await audio.play();
              btn.remove();
            } catch {}
          };
          document.body.appendChild(btn);
        });
      } catch (err) {
        console.error("[CL/ATTACH] error", err);
      }
    },
    [attachToScreenStage]
  );

  /** Cleanup a single producer's consumers/elements */
  const cleanupPeerConsumer = useCallback(
    (producerId: string) => {
      for (const [cid, consumer] of Object.entries(consumersRef.current)) {
        if ((consumer as any).producerId === producerId) {
          try {
            (consumer as any).close();
          } catch {}
          delete consumersRef.current[cid];
          delete consumersByProducerIdRef.current[producerId];
        }
      }
      const audio = audioElsRef.current[producerId];
      if (audio) {
        try {
          audio.parentNode?.removeChild(audio);
        } catch {}
        delete audioElsRef.current[producerId];
      }
      if (screenVideoProducerIdRef.current === producerId) {
        attachToScreenStage(null);
        screenVideoProducerIdRef.current = null;
      }
    },
    [attachToScreenStage]
  );

  /** Full cleanup */
  const cleanupAll = useCallback(() => {
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;

    Object.values(producersRef.current).forEach((p) => {
      try {
        (p as any).close();
      } catch {}
    });
    producersRef.current = {};

    Object.values(consumersRef.current).forEach((c) => {
      try {
        (c as any).close();
      } catch {}
    });
    consumersRef.current = {};
    consumersByProducerIdRef.current = {};

    Object.values(audioElsRef.current).forEach((el) => {
      try {
        el.parentNode?.removeChild(el);
      } catch {}
    });
    audioElsRef.current = {};

    try {
      sendTransportRef.current?.close();
    } catch {}
    sendTransportRef.current = null;

    try {
      recvTransportRef.current?.close();
    } catch {}
    recvTransportRef.current = null;

    deviceRef.current = null;

    // Detach listeners that joinRoom attached, regardless of whether
    // we own the socket. This prevents stale handlers from firing on
    // a shared signalling socket after a next()/leave() cycle, which
    // caused duplicate chat messages and one-way chat issues.
    const sock = socketRef.current;
    if (sock) {
      for (const { event, fn } of joinRoomListenersRef.current) {
        try { sock.off(event, fn); } catch {}
      }
    }
    joinRoomListenersRef.current = [];

    if (!externalSocketRef.current) {
      try {
        socketRef.current?.disconnect();
      } catch {}
    }
    socketRef.current = null;
    externalSocketRef.current = false;

    myPeerIdRef.current = null;
    peersRef.current = {};
    pendingProducersRef.current = [];
    pendingDataProducersRef.current = [];
    dataProducerRef.current = null;
    dataConsumersRef.current = {};
    dataConsumersByProducerIdRef.current = {};
    pendingOutgoingRef.current = [];

    try { (silentAudioProducerRef.current as any)?.close?.(); } catch {}
    silentAudioProducerRef.current = null;
    try { silentAudioTrackRef.current?.stop(); } catch {}
    silentAudioTrackRef.current = null;
    try { silentAudioCtxRef.current?.close(); } catch {}
    silentAudioCtxRef.current = null;
    needConsumeScreenRef.current = false;

    try {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    screenStreamRef.current = null;
    try {
      (screenVideoProducerRef.current as any)?.close?.();
    } catch {}
    screenVideoProducerRef.current = null;
    try {
      (screenAudioProducerRef.current as any)?.close?.();
    } catch {}
    screenAudioProducerRef.current = null;

    attachToScreenStage(null);
    setIsSharingScreen(false);
    setScreenSharerId(null);
    setScreenSharerName(null);
    screenVideoProducerIdRef.current = null;

    setParticipants([]);
    setMicOn(false);
    setProducing(false);
    setMessages([]);
  }, [attachToScreenStage]);

  /** Consume a remote producer (creates recv transport if missing) */
  const consumeProducer = useCallback(
    async (socket: Socket, producerId: string) => {
      if (!recvTransportRef.current) {
        const tpParams = await new Promise<any>((resolve, reject) => {
          socket.emit(
            "createWebRtcTransport",
            {
              roomId: currentRoomIdRef.current,
              direction: "recv",
              enableSctp: true,
            },
            (res: any) => (res?.error ? reject(res.error) : resolve(res))
          );
        });
        if (!deviceRef.current) return;
        const recvTransport: RecvTransport = (
          deviceRef.current as any
        ).createRecvTransport(tpParams);
        recvTransportRef.current = recvTransport;
        recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socket.emit(
            "connectTransport",
            { transportId: recvTransport.id, dtlsParameters },
            (res: any) => (res?.error ? errback(res.error) : callback())
          );
        });
      }

      const consumerParams = await new Promise<any>((resolve, reject) => {
        socket.emit(
          "consume",
          {
            roomId: currentRoomIdRef.current,
            producerId,
            rtpCapabilities: deviceRef.current?.rtpCapabilities,
          },
          (res: any) => (res?.error ? reject(res.error) : resolve(res))
        );
      });

      const consumer: Consumer = await (
        recvTransportRef.current as any
      ).consume({
        id: consumerParams.id,
        producerId: consumerParams.producerId,
        kind: consumerParams.kind,
        rtpParameters: consumerParams.rtpParameters,
      });

      consumersRef.current[consumer.id] = consumer;
      consumersByProducerIdRef.current[consumerParams.producerId] = consumer;

      if (
        consumerParams.kind === "video" &&
        screenVideoProducerIdRef.current &&
        consumerParams.producerId === screenVideoProducerIdRef.current
      ) {
        attachToScreenStage(consumer.track);
        await (consumer as any).setPreferredLayers?.({
          spatialLayer: 2,
          temporalLayer: 2,
        });
      } else {
        attachConsumerTrack(consumer, consumer.producerId);
      }

      socket.emit("consumerResume", { consumerId: consumer.id });
    },
    [attachConsumerTrack, attachToScreenStage]
  );

  /** Ensure we consume the current screen producer once device/recv are ready */
  const ensureConsumeScreenProducer = useCallback(async () => {
    const s = socketRef.current;
    const pid = screenVideoProducerIdRef.current;
    if (!s || !pid) return;
    if (!deviceRef.current || !recvTransportRef.current) return;
    if (consumersByProducerIdRef.current[pid]) return;
    try {
      await consumeProducer(s, pid);
    } catch (e) {
      console.error("[CL] ensureConsumeScreenProducer failed", e);
    }
  }, [consumeProducer]);

  /** Flush buffered producers once device is loaded */
  const flushPendingProducers = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket || !deviceRef.current) return;
    const list = pendingProducersRef.current.splice(0);
    if (!list.length) return;

    for (const p of list) {
      if (p.producerPeerId && p.producerPeerId === myPeerIdRef.current)
        continue;
      try {
        await consumeProducer(socket, p.id);
      } catch {}
    }
  }, [consumeProducer]);

  /** Join room and wire all events.
   *  If an existing socket is passed, reuse it instead of creating a new one.
   */
  const joinRoom = useCallback(
    async (roomId: string, existingSocket?: Socket) => {
      if (socketRef.current) return;
      currentRoomIdRef.current = roomId;

      setMicOn(false);

      let socket: Socket;
      if (existingSocket) {
        socket = existingSocket;
        externalSocketRef.current = true;
      } else {
        socket = io(process.env.NEXT_PUBLIC_API_BASE_URL || "/", {
          path: "/socket.io",
          transports: ["websocket", "polling"],
          withCredentials: true,
          auth: {
            token: getAuthToken(),
          },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 500,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });
        externalSocketRef.current = false;
      }
      socketRef.current = socket;

      // Track listeners so cleanupAll can remove them from a shared socket.
      const on = (event: string, fn: (...args: any[]) => void) => {
        socket.on(event, fn);
        joinRoomListenersRef.current.push({ event, fn });
      };

      myPeerIdRef.current = socket.id as string || null;
      on("connect", () => {
        myPeerIdRef.current = socket.id as string;
      });

      // ---- Server events ----
      on(
        "roomInfo",
        async (data: {
          peers: Array<{ peerId: string; userId?: string; name?: string; avatar?: string | null }>;
          producers?: Array<{
            id: string;
            producerPeerId?: string;
            userId?: string;
            name?: string;
            muted?: boolean;
          }>;
          dataProducers?: Array<{ id: string; producerPeerId?: string }>;
          recentChat?: Array<ChatMessage>;
          screenShare?: {
            sharerUserId?: string | null;
            name?: string | null;
            videoProducerId?: string | null;
            audioProducerId?: string | null;
          };
        }) => {
          const next: Record<string, Participant> = {};
          for (const p of data.peers || []) {
            next[p.peerId] = {
              peerId: p.peerId,
              userId: p.userId,
              id: p.userId || p.peerId,
              name: p.name || p.userId || p.peerId,
              avatar: p.avatar || null,
              muted: true,
            };
          }
          peersRef.current = next;
          setParticipants(Object.values(next));

          if (Array.isArray(data.producers)) {
            for (const prod of data.producers) {
              if (
                prod.producerPeerId &&
                !peersRef.current[prod.producerPeerId]
              ) {
                peersRef.current[prod.producerPeerId] = {
                  peerId: prod.producerPeerId,
                  userId: prod.userId,
                  id: prod.userId || prod.producerPeerId,
                  name: prod.name || prod.userId || prod.producerPeerId,
                  muted: prod.muted,
                };
              } else if (
                prod.producerPeerId &&
                peersRef.current[prod.producerPeerId]
              ) {
                peersRef.current[prod.producerPeerId] = {
                  ...peersRef.current[prod.producerPeerId],
                  muted: prod.muted,
                };
              }
              pendingProducersRef.current.push(prod);
            }
          }

          if (Array.isArray(data.dataProducers)) {
            for (const dp of data.dataProducers) {
              pendingDataProducersRef.current.push({
                id: dp.id,
                producerPeerId: dp.producerPeerId,
              });
            }
          }

          if (Array.isArray(data.recentChat) && data.recentChat.length) {
            setMessages(data.recentChat.slice(-50));
          }

          if (data.screenShare?.sharerUserId) {
            setScreenSharerId(data.screenShare.sharerUserId || null);
            setScreenSharerName(data.screenShare.name || null);

            if (data.screenShare.videoProducerId) {
              screenVideoProducerIdRef.current =
                data.screenShare.videoProducerId;
              needConsumeScreenRef.current = true;
              await ensureConsumeScreenProducer();
            }
          }

          if (deviceRef.current) {
            await flushPendingProducers();
            const s = socketRef.current;
            if (s) {
              for (const d of pendingDataProducersRef.current.splice(0)) {
                if (d.producerPeerId !== myPeerIdRef.current) {
                  try {
                    await consumeDataProducer(s, d.id);
                  } catch {}
                }
              }
            }
          }
        }
      );

      on("peerJoined", ({ peerId, userId, name, avatar }) => {
        peersRef.current[peerId] = {
          peerId,
          userId,
          id: userId || peerId,
          name: name || userId || peerId,
          avatar: avatar || null,
          muted:
            typeof peersRef.current[peerId]?.muted === "boolean"
              ? peersRef.current[peerId]?.muted
              : (peersRef.current[peerId]?.muted ?? true),
        };
        setParticipants(Object.values(peersRef.current));
      });

      on("peerLeft", ({ peerId }) => {
        delete peersRef.current[peerId];
        setParticipants(Object.values(peersRef.current));
      });

      on(
        "newProducer",
        async (data: {
          producerId: string;
          producerPeerId: string;
          userId?: string;
          name?: string;
          muted?: boolean;
        }) => {
          const prev = peersRef.current[data.producerPeerId];
          peersRef.current[data.producerPeerId] = {
            peerId: data.producerPeerId,
            userId: data.userId ?? prev?.userId,
            id: data.userId ?? prev?.id ?? data.producerPeerId,
            name: data.name ?? prev?.name ?? data.userId ?? data.producerPeerId,
            avatar: prev?.avatar ?? null,
            muted: typeof data.muted === "boolean" ? data.muted : prev?.muted,
          };
          emitPresence();

          const payload = {
            id: data.producerId,
            producerPeerId: data.producerPeerId,
            userId: data.userId,
            name: data.name,
            muted: data.muted,
          };
          if (!deviceRef.current) {
            pendingProducersRef.current.push(payload);
          } else if (data.producerPeerId !== myPeerIdRef.current) {
            try {
              await consumeProducer(socket, data.producerId);
            } catch {}
          }
        }
      );

      on("producerMuted", ({ peerId, userId, muted }) => {
        const prev = peersRef.current[peerId];
        if (prev) {
          peersRef.current[peerId] = { ...prev, muted: !!muted };
          emitPresence();
        }
      });

      on("producerClosed", ({ producerId }) => {
        cleanupPeerConsumer(producerId);
      });

      // ---- Screen-share signaling ----
      on(
        "screenShare:state",
        ({
          sharerUserId,
          name,
        }: {
          sharerUserId?: string | null;
          name?: string | null;
        }) => {
          setScreenSharerId(sharerUserId || null);
          setScreenSharerName(name || null);
          if (!sharerUserId) {
            attachToScreenStage(null);
            screenVideoProducerIdRef.current = null;
          }
        }
      );

      on(
        "screenShare:started",
        async ({
          sharerUserId,
          name,
          videoProducerId,
        }: {
          sharerUserId: string;
          name?: string;
          videoProducerId?: string | null;
        }) => {
          if (sharerUserId === user?.id) return;

          setScreenSharerId(sharerUserId);
          setScreenSharerName(name || null);

          if (!videoProducerId) return;

          screenVideoProducerIdRef.current = videoProducerId;
          needConsumeScreenRef.current = true;
          await ensureConsumeScreenProducer();

          const c = consumersByProducerIdRef.current[videoProducerId];
          if (c && (c as any).kind === "video") {
            attachToScreenStage(c.track);
            setTimeout(() => {
              const cc = consumersByProducerIdRef.current[videoProducerId];
              if (cc) attachToScreenStage(cc.track);
            }, 60);
          }
        }
      );

      on(
        "screenShare:stopped",
        ({ sharerUserId }: { sharerUserId: string }) => {
          if (sharerUserId !== user?.id) {
            setScreenSharerId(null);
            setScreenSharerName(null);
            attachToScreenStage(null);
            screenVideoProducerIdRef.current = null;
          }
        }
      );

      on("friendChat:partnerLeft", () => {
        showSnackbar("Your friend left the chat.", { severity: "info" });
        cleanupAll();
        window.removeEventListener("beforeunload", cleanupAll);
        router.replace("/");
      });

      on(
        "newDataProducer",
        async ({
          dataProducerId,
          producerPeerId,
        }: {
          dataProducerId: string;
          producerPeerId: string;
        }) => {
          if (producerPeerId === myPeerIdRef.current) return;

          if (!deviceRef.current || !recvTransportRef.current) {
            pendingDataProducersRef.current.push({
              id: dataProducerId,
              producerPeerId,
            });
            return;
          }

          try {
            await consumeDataProducer(socket, dataProducerId);
          } catch (e) {
            console.error("[CL] consumeDataProducer failed", e);
          }
        }
      );

      on(
        "dataProducerClosed",
        ({ dataProducerId }: { dataProducerId: string }) => {
          const dcEntry = Object.entries(dataConsumersRef.current).find(
            ([, dc]) => (dc as any).dataProducerId === dataProducerId
          );
          if (dcEntry) {
            const [id, dc] = dcEntry;
            try {
              (dc as any).close?.();
            } catch {}
            delete dataConsumersRef.current[id];
          }
          delete dataConsumersByProducerIdRef.current[dataProducerId];
        }
      );

      // ---- Join, then set up device/transports ----
      await new Promise<void>((resolve) => {
        socket.emit("joinRoom", { roomId }, () => resolve());
      });

      try {
        const routerRtpCapabilities = await new Promise<any>(
          (resolve, reject) => {
            socket.emit("getRouterRtpCapabilities", { roomId }, (res: any) => {
              if (res?.error) return reject(res.error);
              resolve(res.routerRtpCapabilities);
            });
          }
        );

        const device = new Device();
        await device.load({ routerRtpCapabilities });
        deviceRef.current = device;

        await createDataProducerIfNeeded();

        // SEND transport
        const sendTpParams = await new Promise<any>((resolve, reject) => {
          socket.emit(
            "createWebRtcTransport",
            { roomId, direction: "send", enableSctp: true },
            (res: any) => (res?.error ? reject(res.error) : resolve(res))
          );
        });
        const sendTransport: SendTransport = (
          device as any
        ).createSendTransport(sendTpParams);
        sendTransportRef.current = sendTransport;

        sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socket.emit(
            "connectTransport",
            { transportId: sendTransport.id, dtlsParameters },
            (res: any) => (res?.error ? errback(res.error) : callback())
          );
        });

        sendTransport.on(
          "produce",
          ({ kind, rtpParameters }, callback, errback) => {
            socket.emit(
              "produce",
              { transportId: sendTransport.id, kind, rtpParameters },
              (res: any) =>
                res?.error
                  ? errback(res.error)
                  : callback({ id: res.producerId })
            );
          }
        );

        // Force DTLS/ICE on the send transport by producing a silent
        // audio track synthesized via WebAudio (no mic permission
        // required). This is the only reliable way to get Safari to
        // actually open the SCTP DataChannel created by produceData().
        const primeSendTransport = async () => {
          if (silentAudioProducerRef.current) return;
          try {
            const Ctx: any =
              (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return;
            const ctx: AudioContext = new Ctx();
            silentAudioCtxRef.current = ctx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0; // silent
            const dest = (ctx as any).createMediaStreamDestination();
            osc.connect(gain).connect(dest);
            osc.start();
            const track = (dest.stream as MediaStream).getAudioTracks()[0];
            if (!track) return;
            silentAudioTrackRef.current = track;
            const producer = await (sendTransport as any).produce({
              track,
              appData: { silent: true },
              disableTrackOnPause: false,
              stopTracks: false,
            });
            silentAudioProducerRef.current = producer;
          } catch (e) {
            console.warn("[CL] primeSendTransport failed", e);
          }
        };

        (sendTransport as any).on(
          "producedata",
          (params: any, callback: any, errback: any) => {
            socket.emit(
              "produceData",
              {
                transportId: sendTransport.id,
                sctpStreamParameters: params.sctpStreamParameters,
                label: params.label,
                protocol: params.protocol,
              },
              (res: any) =>
                res?.error
                  ? errback(res.error)
                  : callback({ id: res.dataProducerId })
            );
          }
        );

        // Prime DTLS/ICE before creating the data producer so the
        // underlying SCTP association is ready to open immediately.
        await primeSendTransport();
        await createDataProducerIfNeeded();

        const onReplaced = () => {
          showSnackbar(
            "This room is open in another tab. Closing this session.",
            { severity: "info" }
          );
          router.replace("/");
        };
        on("session:replaced", onReplaced);

        // RECV transport
        if (!recvTransportRef.current) {
          const recvTpParams = await new Promise<any>((resolve, reject) => {
            socket.emit(
              "createWebRtcTransport",
              { roomId, direction: "recv", enableSctp: true },
              (res: any) => (res?.error ? reject(res.error) : resolve(res))
            );
          });
          const recvTransport: RecvTransport = (
            device as any
          ).createRecvTransport(recvTpParams);
          recvTransportRef.current = recvTransport;
          recvTransport.on(
            "connect",
            ({ dtlsParameters }, callback, errback) => {
              socket.emit(
                "connectTransport",
                { transportId: recvTransport.id, dtlsParameters },
                (res: any) => (res?.error ? errback(res.error) : callback())
              );
            }
          );
        }

        if (needConsumeScreenRef.current) {
          await ensureConsumeScreenProducer();
          needConsumeScreenRef.current = false;
        }

        await flushPendingProducers();

        const s = socketRef.current;
        if (s) {
          for (const d of pendingDataProducersRef.current.splice(0)) {
            if (d.producerPeerId !== myPeerIdRef.current) {
              try {
                await consumeDataProducer(s, d.id);
              } catch {}
            }
          }
        }
      } catch (err) {
        cleanupAll();
        throw err;
      }

      window.addEventListener("beforeunload", cleanupAll);
    },
    [
      attachConsumerTrack,
      attachToScreenStage,
      cleanupAll,
      consumeDataProducer,
      consumeProducer,
      createDataProducerIfNeeded,
      flushPendingProducers,
      ensureConsumeScreenProducer,
      showSnackbar,
      router,
    ]
  );

  /** Chat */
  const sendChat = useCallback(
    (text: string) => {
      const dp = dataProducerRef.current;
      if (!dp || !text || !text.trim()) return;
      const now = Date.now();
      const msg = {
        t: "chat",
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        from: user?.id || "me",
        text: text.slice(0, 16000),
        ts: now,
      };
      const payload = JSON.stringify(msg);
      const ch: any = (dp as any)._channel || (dp as any).channel || null;
      if (
        ch &&
        typeof ch.bufferedAmount === "number" &&
        ch.bufferedAmount > 1_000_000
      ) {
        return;
      }
      const rs: string | undefined = ch?.readyState || (dp as any).readyState;
      // Optimistically show our own message immediately.
      appendMessage({ id: msg.id, from: "me", text: msg.text, ts: msg.ts });

      if (rs && rs !== "open") {
        // Queue; will flush when the data channel opens. Safari often
        // takes a few hundred ms after produceData before readyState is
        // actually 'open', and dp.send() in that window silently drops.
        pendingOutgoingRef.current.push(payload);
        // Belt-and-braces: also retry shortly in case no 'open' event fires.
        setTimeout(() => flushPendingOutgoing(), 200);
        return;
      }
      try {
        dp.send(payload);
      } catch (e) {
        console.warn("[CL] dp.send threw; queueing", e);
        pendingOutgoingRef.current.push(payload);
        setTimeout(() => flushPendingOutgoing(), 200);
      }
    },
    [appendMessage, flushPendingOutgoing, user?.id]
  );

  const setTyping = useCallback((on: boolean) => {
    const dp = dataProducerRef.current;
    if (!dp) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 250) return;
    lastTypingSentRef.current = now;
    try {
      dp.send(
        JSON.stringify({
          t: "typing",
          from: myPeerIdRef.current || "me",
          on: !!on,
          ts: now,
        })
      );
    } catch {}
  }, []);

  /** Screen-share control (client side) */
  const requestStartShare = useCallback(async (): Promise<{
    ok: boolean;
    reason?: string;
  }> => {
    const socket = socketRef.current;
    if (!socket) return { ok: false, reason: "not-connected" };
    return await new Promise((resolve) => {
      socket.emit(
        "screenShare:request",
        {
          roomId: currentRoomIdRef.current,
          userId: user?.id,
          name: user?.name || user?.email || "User",
        },
        (res: any) => {
          if (res && res.ok) resolve({ ok: true });
          else resolve({ ok: false, reason: res?.reason || "blocked" });
        }
      );
    });
  }, [user?.id, user?.name, user?.email]);

  const stopScreenShare = useCallback(() => {
    try {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    screenStreamRef.current = null;

    if (screenVideoProducerRef.current) {
      try {
        (screenVideoProducerRef.current as any).close();
      } catch {}
      screenVideoProducerRef.current = null;
    }
    if (screenAudioProducerRef.current) {
      try {
        (screenAudioProducerRef.current as any).close();
      } catch {}
      screenAudioProducerRef.current = null;
    }

    socketRef.current?.emit("screenShare:stopped", {
      roomId: currentRoomIdRef.current,
      userId: user?.id,
    });

    setIsSharingScreen(false);
    setScreenSharerId(null);
    setScreenSharerName(null);
    screenVideoProducerIdRef.current = null;
    attachToScreenStage(null);
  }, [attachToScreenStage, user?.id]);

  const startScreenShare = useCallback(async () => {
    if (
      location.protocol !== "https:" &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1"
    ) {
      showSnackbar("Screen share requires HTTPS (or localhost).", {
        severity: "error",
      });
      return;
    }

    if (!sendTransportRef.current) return;
    if (screenVideoProducerRef.current) return;

    if (!deviceRef.current?.canProduce("video")) {
      showSnackbar(
        "This browser cannot send video to the SFU (codec mismatch).",
        { severity: "error" }
      );
      return;
    }

    if (screenSharerId && screenSharerId !== user?.id) {
      showSnackbar(`${screenSharerName || "Someone"} is already sharing`, {
        severity: "info",
      });
      return;
    }

    const gate = await requestStartShare();
    if (!gate.ok) {
      showSnackbar("Screen share is in use", { severity: "info" });
      return;
    }

    const ua = navigator.userAgent;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const isChromiumDesktop =
      /\b(Edg|Chrome|Chromium)\b/i.test(ua) && !isMobile;

    const firstTryConstraints: MediaStreamConstraints =
      isMobile || isSafari
        ? { video: true, audio: false }
        : {
            video: {
              width: { ideal: 1920, max: 2560 },
              height: { ideal: 1080, max: 1440 },
              frameRate: { ideal: 30, max: 60 },
            },
            audio: true,
          };

    let stream: MediaStream;
    try {
      stream = await (navigator.mediaDevices as any).getDisplayMedia(
        firstTryConstraints
      );
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "AbortError") {
        showSnackbar("Permission denied or screen picker closed.", {
          severity: "error",
        });
        return;
      }
      try {
        stream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true,
          audio: false,
        });
      } catch {
        showSnackbar("Could not start screen share.", { severity: "error" });
        return;
      }
    }

    screenStreamRef.current = stream;
    const vTrack = stream.getVideoTracks()[0];
    if (!vTrack) {
      showSnackbar("No video track from display capture.", {
        severity: "error",
      });
      return;
    }
    if ("contentHint" in vTrack) vTrack.contentHint = "detail";

    const caps: any = (deviceRef.current as any)?.rtpCapabilities;
    const findCodec = (mime: string) =>
      caps?.codecs?.find((c: any) => String(c.mimeType).toLowerCase() === mime);
    const preferCodec = isSafari
      ? findCodec("video/h264")
      : findCodec("video/vp8");

    let vProducer: any = null;

    try {
      vProducer = await (sendTransportRef.current as any).produce({
        track: vTrack,
        codec: preferCodec,
        codecOptions: { videoGoogleStartBitrate: isSafari ? 800 : 1200 },
      });
    } catch (e1) {
      if (isChromiumDesktop) {
        try {
          vProducer = await (sendTransportRef.current as any).produce({
            track: vTrack,
            encodings: [
              { maxBitrate: 3_000_000, priority: "high" },
              {
                scaleResolutionDownBy: 2,
                maxBitrate: 900_000,
                priority: "medium",
              },
            ],
            codecOptions: { videoGoogleStartBitrate: 1200 },
          });
          try {
            await vProducer.setMaxSpatialLayer?.(1);
          } catch {}
        } catch (e2) {
          // swallow
        }
      }
    }

    if (!vProducer) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
      screenStreamRef.current = null;
      showSnackbar("Could not start screen share (video produce failed).", {
        severity: "error",
      });
      return;
    }

    screenVideoProducerRef.current = vProducer;
    const videoProducerId = vProducer.id;
    vTrack.onended = () => stopScreenShare();

    const aTrack = stream.getAudioTracks()[0];
    let audioProducerId: string | null = null;
    if (aTrack) {
      try {
        const aProducer = await (sendTransportRef.current as any).produce({
          track: aTrack,
        });
        screenAudioProducerRef.current = aProducer;
        audioProducerId = aProducer.id;
      } catch {
        // ignore audio failure
      }
    }

    socketRef.current?.emit("screenShare:bind", {
      roomId: currentRoomIdRef.current,
      userId: user?.id,
      videoProducerId,
      audioProducerId,
    });

    setIsSharingScreen(true);
    setScreenSharerId(user?.id ?? null);
    setScreenSharerName(user?.name || user?.email || "You");
    screenVideoProducerIdRef.current = videoProducerId;
    attachToScreenStage(vTrack || null);
  }, [
    attachToScreenStage,
    requestStartShare,
    screenSharerId,
    screenSharerName,
    stopScreenShare,
    user?.id,
    user?.name,
    user?.email,
    showSnackbar,
  ]);

  const toggleScreenShare = useCallback(async () => {
    if (isSharingScreen) stopScreenShare();
    else await startScreenShare();
  }, [isSharingScreen, startScreenShare, stopScreenShare]);

  /** Clean up media and disconnect socket, but do NOT navigate */
  const cleanupAndDisconnect = useCallback(() => {
    const currentRoomId = currentRoomIdRef.current;
    if (currentRoomId.startsWith("directchat:")) {
      try {
        socketRef.current?.emit("friendChat:leave");
      } catch {}
    }
    try {
      socketRef.current?.emit("leaveRoom");
    } catch {}
    if (isSharingScreen) stopScreenShare();
    cleanupAll();
    window.removeEventListener("beforeunload", cleanupAll);
  }, [cleanupAll, isSharingScreen, stopScreenShare]);

  /** Leave room */
  const leaveRoom = useCallback(() => {
    cleanupAndDisconnect();
    router.replace("/");
  }, [cleanupAndDisconnect, router]);

  /** Mic toggle (producer pause/resume) */
  const toggleMic = useCallback(async () => {
    // Lazily request mic permission on first use
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        localStreamRef.current = stream;
        const track = stream.getAudioTracks()[0];
        if (track) track.enabled = false;
      } catch (err) {
        showSnackbar("Microphone permission denied", { severity: "error" });
        return;
      }
    }

    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;

    const turningOn = !track.enabled;

    if (turningOn) {
      if (!sendTransportRef.current) return;

      let producer = Object.values(producersRef.current)[0] as any | undefined;
      if (!producer) {
        try {
          producer = await (sendTransportRef.current as any).produce({ track });
          producersRef.current[producer.id] = producer;
          setProducing(true);
        } catch {
          return;
        }
      } else {
        try {
          producer.resume?.();
        } catch {}
      }

      track.enabled = true;
      setMicOn(true);
      try {
        socketRef.current?.emit("producerMuted", { muted: false });
      } catch {}
      return;
    }

    track.enabled = false;
    setMicOn(false);

    const producer = Object.values(producersRef.current)[0] as any | undefined;
    if (producer) {
      try {
        producer.pause?.();
      } catch {}
    }
    try {
      socketRef.current?.emit("producerMuted", { muted: true });
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      cleanupAll();
      window.removeEventListener("beforeunload", cleanupAll);
    };
  }, [cleanupAll]);

  return {
    joinRoom,
    leaveRoom,
    cleanupAndDisconnect,
    toggleMic,
    micOn,
    participants,
    producing,
    messages,
    sendChat,
    setTyping,

    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    isSharingScreen,
    screenSharerId,
    screenSharerName,
  };
}
