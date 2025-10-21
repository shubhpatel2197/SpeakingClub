/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useCallback, useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import { io, Socket } from "socket.io-client";
import { useSnackbar } from "../context/SnackbarProvider";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/AuthProvider";

type SendTransport = ReturnType<Device["createSendTransport"]>;
type RecvTransport = ReturnType<Device["createRecvTransport"]>;
type Producer = any;
type Consumer = any;

type Participant = {
  id: string;
  peerId?: string;
  userId?: string;
  name?: string | null;
  muted?: boolean;
};

export function useMediasoup() {
  const { showSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const navigate = useNavigate(); // ok to keep

  const socketRef = useRef<Socket | null>(null);
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

  function emitPresence() {
    const list = Object.values(peersRef.current);
    setParticipants(list);
  }

  const appendMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-49), m]);
  }, []);

  const createDataProducerIfNeeded = useCallback(async () => {
    if (!sendTransportRef.current || dataProducerRef.current) return;
    const dp = await (sendTransportRef.current as any).produceData({
      ordered: true,
      label: "chat",
      protocol: "json",
    });
    dataProducerRef.current = dp;
  }, []);

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

    // Set flags before assigning srcObject for autoplay
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

    // For screenshare, VP9 SVC is king when available
    return (
      vp9 || h264 || vp8 || caps?.codecs?.find((c: any) => c.kind === "video")
    );
  }

  /** DataChannel consumer */
  const consumeDataProducer = useCallback(
    async (socket: Socket, dataProducerId: string) => {
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
      (dataConsumer as any).on("message", (data: any) => {
        try {
          const m = JSON.parse(
            typeof data === "string" ? data : new TextDecoder().decode(data)
          );
          if (m.t === "chat")
            appendMessage({ id: m.id, from: m.from, text: m.text, ts: m.ts });
          else if (m.t === "typing" && m.from)
            typingRef.current[m.from] = !!m.on;
        } catch {}
      });

      socket.emit("dataConsumerResume", { dataConsumerId: dataConsumer.id });
    },
    [appendMessage]
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
          return; // ignore non-screen videos here
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

    try {
      socketRef.current?.disconnect();
    } catch {}
    socketRef.current = null;

    myPeerIdRef.current = null;
    peersRef.current = {};
    pendingProducersRef.current = [];
    pendingDataProducersRef.current = [];
    dataProducerRef.current = null;
    dataConsumersRef.current = {};
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

      // If this is the known screen producer, attach right away
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

  /** Join room and wire all events */
  const joinRoom = useCallback(
    async (roomId: string) => {
      if (socketRef.current) return;
      currentRoomIdRef.current = roomId;

      // Get mic permission but start muted
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        localStreamRef.current = stream;
        const track = stream.getAudioTracks()[0];
        if (track) track.enabled = false;
        setMicOn(false);
      } catch (err) {
        showSnackbar("Microphone permission denied", { severity: "error" });
        throw err;
      }

      const socket = io("/", {
        path: "/socket.io",
        transports: ["websocket"],
        withCredentials: true,
        timeout: 20000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        myPeerIdRef.current = socket.id as string;
      });

      // ---- Server events ----
      socket.on(
        "roomInfo",
        async (data: {
          peers: Array<{ peerId: string; userId?: string; name?: string }>;
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

          // If someone is already sharing, capture their producerId now
          if (data.screenShare?.sharerUserId) {
            setScreenSharerId(data.screenShare.sharerUserId || null);
            setScreenSharerName(data.screenShare.name || null);

            if (data.screenShare.videoProducerId) {
              screenVideoProducerIdRef.current =
                data.screenShare.videoProducerId;
              needConsumeScreenRef.current = true; // defer until transports ready
              await ensureConsumeScreenProducer(); // will no-op until ready
            }
          }

          // If device already loaded, flush buffered producers & data producers now
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

      socket.on("peerJoined", ({ peerId, userId, name }) => {
        peersRef.current[peerId] = {
          peerId,
          userId,
          id: userId || peerId,
          name: name || userId || peerId,
          muted:
            typeof peersRef.current[peerId]?.muted === "boolean"
              ? peersRef.current[peerId]?.muted
              : (peersRef.current[peerId]?.muted ?? true),
        };
        setParticipants(Object.values(peersRef.current));
      });

      socket.on("peerLeft", ({ peerId }) => {
        delete peersRef.current[peerId];
        setParticipants(Object.values(peersRef.current));
      });

      socket.on(
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

      socket.on("producerMuted", ({ peerId, userId, muted }) => {
        const prev = peersRef.current[peerId];
        if (prev) {
          peersRef.current[peerId] = { ...prev, muted: !!muted };
          emitPresence();
        }
      });

      socket.on("producerClosed", ({ producerId }) => {
        cleanupPeerConsumer(producerId);
      });

      // ---- Screen-share signaling ----
      socket.on(
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

      socket.on(
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
          if (sharerUserId === user.id) return; // local sharer already attached

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

      socket.on(
        "screenShare:stopped",
        ({ sharerUserId }: { sharerUserId: string }) => {
          if (sharerUserId !== user.id) {
            setScreenSharerId(null);
            setScreenSharerName(null);
            attachToScreenStage(null);
            screenVideoProducerIdRef.current = null;
          }
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

        await createDataProducerIfNeeded();

        socket.on(
          "newDataProducer",
          async ({
            dataProducerId,
            producerPeerId,
          }: {
            dataProducerId: string;
            producerPeerId: string;
          }) => {
            // Ignore our own data producer
            if (producerPeerId === myPeerIdRef.current) return;

            // If device/recv not ready yet, queue it
            if (!deviceRef.current || !recvTransportRef.current) {
              pendingDataProducersRef.current.push({
                id: dataProducerId,
                producerPeerId,
              });
              return;
            }

            // Otherwise consume immediately
            try {
              await consumeDataProducer(socket, dataProducerId);
            } catch (e) {
              console.error("[CL] consumeDataProducer failed", e);
            }
          }
        );

        socket.on(
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
          }
        );

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

        // Now that transports exist, if we owe a screen consume, do it
        if (needConsumeScreenRef.current) {
          await ensureConsumeScreenProducer();
          needConsumeScreenRef.current = false;
        }

        // Flush any producers that arrived early
        await flushPendingProducers();

        // Flush pending data producers
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
        from: user.id || "me",
        text: text.slice(0, 16000),
        ts: now,
      };
      try {
        const ch: any = (dp as any)._channel || (dp as any).channel || null;
        if (
          ch &&
          typeof ch.bufferedAmount === "number" &&
          ch.bufferedAmount > 1_000_000
        )
          return;
        dp.send(JSON.stringify(msg));
        appendMessage({ id: msg.id, from: "me", text: msg.text, ts: msg.ts });
      } catch {}
    },
    [appendMessage]
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
          userId: user.id,
          name: user.name || user.email || "User",
        },
        (res: any) => {
          if (res && res.ok) resolve({ ok: true });
          else resolve({ ok: false, reason: res?.reason || "blocked" });
        }
      );
    });
  }, [user?.id, user?.name, user?.email]);

  const startScreenShare = useCallback(async () => {
    if (!sendTransportRef.current) return;
    if (screenVideoProducerRef.current) return;

    if (!deviceRef.current?.canProduce("video")) {
      showSnackbar(
        "This browser cannot send video to the SFU (codec mismatch).",
        {
          severity: "error",
        }
      );
      return;
    }

    if (screenSharerId && screenSharerId !== user.id) {
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

    const displayStream = await (navigator.mediaDevices as any).getDisplayMedia(
      {
        video: {
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1440 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: true,
      }
    );

    screenStreamRef.current = displayStream;

    const vTrack = displayStream.getVideoTracks()[0];
if (!vTrack) {
  showSnackbar("No video track from display capture.", { severity: "error" });
  return;
}
if ("contentHint" in vTrack) vTrack.contentHint = "detail"; // or "text"

if (!sendTransportRef.current) {
  console.warn("[SCREEN] No send transport yet");
  showSnackbar("Not ready to send (transport missing).", { severity: "error" });
  return;
}

const dev: any = deviceRef.current;
const handlerName = dev?.handlerName;
const caps = dev?.rtpCapabilities;

console.log("[SCREEN] handlerName=", handlerName);
console.log("[SCREEN] device.canProduce(video)=", deviceRef.current?.canProduce("video"));
console.log("[SCREEN] rtpCapabilities=", caps);

// 1) MINIMAL attempt
let vProducer: any = null;
try {
  console.log("[SCREEN] trying MINIMAL produce()");
  vProducer = await (sendTransportRef.current as any).produce({ track: vTrack });
} catch (e) {
  console.warn("[SCREEN] MINIMAL produce failed", e);
}

// 2) If minimal failed, try safe simulcast (no explicit codec)
if (!vProducer) {
  try {
    console.log("[SCREEN] trying SAFE SIMULCAST");
    vProducer = await (sendTransportRef.current as any).produce({
      track: vTrack,
      encodings: [
        { maxBitrate: 3_000_000, priority: "high" },
        { scaleResolutionDownBy: 2, maxBitrate: 900_000, priority: "medium" },
      ],
      codecOptions: { videoGoogleStartBitrate: 1200 },
    });
    try { await vProducer.setMaxSpatialLayer?.(1); } catch {}
  } catch (e) {
    console.warn("[SCREEN] SAFE SIMULCAST failed", e);
  }
}

// 3) Optional: VP9 SVC on Chromium only
if (!vProducer) {
  const isChromium = /\b(Edg|Chrome|Chromium)\b/i.test(navigator.userAgent);
  const vp9 = caps?.codecs?.find((c: any) => String(c.mimeType).toLowerCase() === "video/vp9");
  if (isChromium && vp9) {
    try {
      console.log("[SCREEN] trying VP9 SVC (S3T3_KEY)");
      vProducer = await (sendTransportRef.current as any).produce({
        track: vTrack,
        codec: vp9,
        encodings: [{ scalabilityMode: "S3T3_KEY", priority: "high" }],
        codecOptions: { videoGoogleStartBitrate: 1500 },
      });
    } catch (e) {
      console.warn("[SCREEN] VP9 SVC failed", e);
    }
  }
}

if (!vProducer) {
  console.error("[SCREEN] All produce attempts failed", { handlerName, caps });
  showSnackbar("Could not start screen share (video produce failed).", { severity: "error" });
  return;
}

screenVideoProducerRef.current = vProducer;
const videoProducerId = vProducer.id;
vTrack.onended = () => stopScreenShare();

// bind & notify server as you already do
socketRef.current?.emit("screenShare:bind", {
  roomId: currentRoomIdRef.current,
  userId: user.id,
  videoProducerId,
  audioProducerId: null,
});


    const aTrack = displayStream.getAudioTracks()[0];
    let audioProducerId: string | null = null;
    if (aTrack) {
      const aProducer = await (sendTransportRef.current as any).produce({
        track: aTrack,
      });
      screenAudioProducerRef.current = aProducer;
      audioProducerId = aProducer.id;
    }

    // Announce binding so others know which producerId is "the screen"
    socketRef.current?.emit("screenShare:bind", {
      roomId: currentRoomIdRef.current,
      userId: user.id,
      videoProducerId,
      audioProducerId,
    });

    setIsSharingScreen(true);
    setScreenSharerId(user.id);
    setScreenSharerName(user.name || user.email || "You");
    screenVideoProducerIdRef.current = videoProducerId;
    attachToScreenStage(vTrack || null);
  }, [
    requestStartShare,
    screenSharerId,
    screenSharerName,
    user?.id,
    user?.name,
    user?.email,
    showSnackbar,
    attachToScreenStage,
  ]);

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
      userId: user.id,
    });

    setIsSharingScreen(false);
    setScreenSharerId(null);
    setScreenSharerName(null);
    screenVideoProducerIdRef.current = null;
    attachToScreenStage(null);
  }, [attachToScreenStage, user?.id]);

  const toggleScreenShare = useCallback(async () => {
    if (isSharingScreen) stopScreenShare();
    else await startScreenShare();
  }, [isSharingScreen, startScreenShare, stopScreenShare]);

  /** Leave room */
  const leaveRoom = useCallback(() => {
    try {
      socketRef.current?.emit("leaveRoom");
    } catch {}
    if (isSharingScreen) stopScreenShare();
    cleanupAll();
    window.removeEventListener("beforeunload", cleanupAll);
    navigate("/", { replace: true });
  }, [cleanupAll, isSharingScreen, stopScreenShare]);

  /** Mic toggle (producer pause/resume) */
  const toggleMic = useCallback(async () => {
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
