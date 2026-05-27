/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client'

import { useCallback, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

/**
 * P2P mesh audio — used for rooms with < 5 peers.
 *
 * Each pair of peers establishes a direct RTCPeerConnection carrying an
 * audio-only MediaStream.  The socket server relays only SDP offers/answers
 * and ICE candidates (no media flows through the server).
 *
 * Speaking detection is built-in: each remote stream is analysed for volume
 * and the result is exposed via `speakingByPeerId`.
 */

type PeerConn = {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  audioSender: RTCRtpSender | null;
  meter: {
    ctx: AudioContext;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    rafId: number;
  } | null;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
};

export function useP2PAudio() {
  const peersRef = useRef<Record<string, PeerConn>>({});
  const socketRef = useRef<Socket | null>(null);
  const myPeerIdRef = useRef<string>("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const [speakingByPeerId, setSpeakingByPeerId] = useState<
    Record<string, boolean>
  >({});

  /* ── helpers ────────────────────────────────────────────────── */

  const makeSpeaking = useCallback(
    (peerId: string, speaking: boolean) => {
      setSpeakingByPeerId((prev) => {
        if (prev[peerId] === speaking) return prev;
        return { ...prev, [peerId]: speaking };
      });
    },
    []
  );

  /** Start an audio-level meter on a remote track. */
  const startMeter = useCallback(
    (peerId: string, track: MediaStreamTrack) => {
      const Ctx: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;

      const ctx = new Ctx();
      const stream = new MediaStream([track]);
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const n = (data[i] - 128) / 128;
          sumSq += n * n;
        }
        const rms = Math.sqrt(sumSq / data.length);
        makeSpeaking(peerId, track.enabled && rms > 0.035);

        const peer = peersRef.current[peerId];
        if (peer?.meter) {
          peer.meter.rafId = requestAnimationFrame(tick);
        }
      };

      return {
        ctx,
        source,
        analyser,
        rafId: requestAnimationFrame(tick),
      };
    },
    [makeSpeaking]
  );

  const stopMeter = useCallback((peerId: string) => {
    const peer = peersRef.current[peerId];
    if (!peer?.meter) return;
    cancelAnimationFrame(peer.meter.rafId);
    try { peer.meter.source.disconnect(); } catch {}
    try { peer.meter.analyser.disconnect(); } catch {}
    try { peer.meter.ctx.close(); } catch {}
    peer.meter = null;
  }, []);

  const ensureAudioPlayback = useCallback((audioEl: HTMLAudioElement) => {
    audioEl.play().catch(() => {
      const existing = document.getElementById("enable-p2p-audio");
      if (existing) return;
      const btn = document.createElement("button");
      btn.id = "enable-p2p-audio";
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
          await audioEl.play();
          btn.remove();
        } catch {}
      };
      document.body.appendChild(btn);
    });
  }, []);

  /** Create an RTCPeerConnection, add the local stream, and wire events. */
  const createConnection = useCallback(
    (
      socket: Socket,
      myId: string,
      remotePeerId: string,
      localStream: MediaStream | null,
      initiator: boolean
    ): PeerConn => {
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current.length
          ? iceServersRef.current
          : [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Audio element for playback
      const audioEl = document.createElement("audio");
      audioEl.setAttribute("playsinline", "");
      audioEl.autoplay = true;
      audioEl.controls = false;
      audioEl.volume = 1;
      (
        document.getElementById("remote-audio-container") ?? document.body
      ).appendChild(audioEl);

      const entry: PeerConn = {
        pc,
        audioEl,
        audioSender: null,
        meter: null,
        polite: myId.localeCompare(remotePeerId) < 0,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
      };
      peersRef.current[remotePeerId] = entry;

      // Negotiate an audio m-line from the start, then swap the mic track onto
      // the sender later. This is more reliable than adding tracks after the
      // connection is already established.
      const audioTransceiver = pc.addTransceiver("audio", {
        direction: "sendrecv",
      });
      entry.audioSender = audioTransceiver.sender;
      const localTrack = localStream?.getAudioTracks?.()[0] ?? null;
      if (localTrack) {
        entry.audioSender.replaceTrack(localTrack).catch(() => {});
      }

      // Remote tracks → playback + speaking meter
      pc.ontrack = (ev) => {
        const ms = ev.streams?.[0] || new MediaStream([ev.track]);
        // @ts-ignore
        audioEl.srcObject = ms;
        audioEl.muted = false;
        ensureAudioPlayback(audioEl);
        stopMeter(remotePeerId);
        entry.meter = startMeter(remotePeerId, ev.track);
      };

      // ICE candidates
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          socket.emit("p2p:signal", {
            to: remotePeerId,
            data: { type: "candidate", candidate: ev.candidate },
          });
        }
      };

      // Any peer may need to renegotiate later when tracks are added/removed.
      pc.onnegotiationneeded = async () => {
        // Let the initiator own the very first offer. On the answering side,
        // wait until a remote description exists before starting renegotiation,
        // otherwise we can get stuck in have-local-offer/have-local-offer.
        if (!initiator && !pc.remoteDescription) return;
        try {
          entry.makingOffer = true;
          const offer = await pc.createOffer();
          if (pc.signalingState !== "stable") return;
          await pc.setLocalDescription(offer);
          socket.emit("p2p:signal", {
            to: remotePeerId,
            data: { type: "offer", sdp: pc.localDescription },
          });
        } catch (e) {
          console.error("[P2P] offer error", e);
        } finally {
          entry.makingOffer = false;
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          makeSpeaking(remotePeerId, false);
        }
      };

      return entry;
    },
    [ensureAudioPlayback, makeSpeaking, startMeter, stopMeter]
  );

  /* ── signalling handler (incoming from remote peer) ─────────── */

  const handleSignal = useCallback(
    async (fromPeerId: string, data: any) => {
      const socket = socketRef.current;
      if (!socket) return;

      let entry = peersRef.current[fromPeerId];

      // Received an offer from a peer we haven't seen yet → create answerer
      if (!entry && data.type === "offer") {
        entry = createConnection(
          socket,
          myPeerIdRef.current,
          fromPeerId,
          localStreamRef.current,
          false
        );
      }
      if (!entry) return;

      const { pc } = entry;

      if (data.type === "offer") {
        const readyForOffer =
          !entry.makingOffer &&
          (pc.signalingState === "stable" ||
            entry.isSettingRemoteAnswerPending);
        const offerCollision = !readyForOffer;
        entry.ignoreOffer = !entry.polite && offerCollision;
        if (entry.ignoreOffer) return;

        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        entry.ignoreOffer = false;
        const localTrack = localStreamRef.current?.getAudioTracks?.()[0] ?? null;
        if (entry.audioSender) {
          await entry.audioSender.replaceTrack(localTrack);
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("p2p:signal", {
          to: fromPeerId,
          data: { type: "answer", sdp: pc.localDescription },
        });
      } else if (data.type === "answer") {
        entry.isSettingRemoteAnswerPending = true;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } finally {
          entry.isSettingRemoteAnswerPending = false;
          entry.ignoreOffer = false;
        }
      } else if (data.type === "candidate") {
        try {
          if (entry.ignoreOffer) return;
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {}
      }
    },
    [createConnection]
  );

  /* ── public API ─────────────────────────────────────────────── */

  /**
   * Initialise P2P connections with all existing peers in the room.
   * Call this once after joining a room that is in P2P mode.
   */
  const initP2P = useCallback(
    (
      socket: Socket,
      myId: string,
      peerIds: string[],
      localStream: MediaStream | null,
      iceServers?: RTCIceServer[]
    ) => {
      socketRef.current = socket;
      myPeerIdRef.current = myId;
      localStreamRef.current = localStream;
      if (iceServers) iceServersRef.current = iceServers;

      // Create outgoing connections as initiator
      for (const pid of peerIds) {
        if (pid === myId) continue;
        if (peersRef.current[pid]) continue;
        createConnection(socket, myId, pid, localStream, true);
      }
    },
    [createConnection]
  );

  /** Add a single new peer (called on `peerJoined`). */
  const addPeer = useCallback(
    (
      socket: Socket,
      myId: string,
      remotePeerId: string,
      localStream: MediaStream | null
    ) => {
      socketRef.current = socket;
      myPeerIdRef.current = myId;
      localStreamRef.current = localStream;

      // We are the initiator because we were already in the room
      if (!peersRef.current[remotePeerId]) {
        createConnection(socket, myId, remotePeerId, localStream, true);
      }
    },
    [createConnection]
  );

  /** Tear down the connection for a single peer. */
  const removePeer = useCallback(
    (remotePeerId: string) => {
      const entry = peersRef.current[remotePeerId];
      if (!entry) return;
      stopMeter(remotePeerId);
      try { entry.pc.close(); } catch {}
      try { entry.audioEl.parentNode?.removeChild(entry.audioEl); } catch {}
      delete peersRef.current[remotePeerId];
      setSpeakingByPeerId((prev) => {
        if (!(remotePeerId in prev)) return prev;
        const next = { ...prev };
        delete next[remotePeerId];
        return next;
      });
    },
    [stopMeter]
  );

  /** Tear down ALL P2P connections (mode switch or leave). */
  const teardownAllP2P = useCallback(() => {
    for (const pid of Object.keys(peersRef.current)) {
      removePeer(pid);
    }
    socketRef.current = null;
    setSpeakingByPeerId({});
  }, [removePeer]);

  /**
   * Replace the local audio stream on all active connections.
   * Call this when the user toggles mic (new track) so remote
   * peers hear the update.
   */
  const replaceLocalStream = useCallback(
    (newStream: MediaStream | null) => {
      localStreamRef.current = newStream;
      for (const [, entry] of Object.entries(peersRef.current)) {
        const sender =
          entry.audioSender ||
          entry.pc.getSenders().find((s) => s.track?.kind === "audio") ||
          null;
        entry.audioSender = sender;
        const newTrack = newStream?.getAudioTracks?.()[0] ?? null;

        if (sender) {
          sender.replaceTrack(newTrack).catch(() => {});
          continue;
        }

        if (newStream) {
          if (newTrack) {
            entry.audioSender = entry.pc.addTrack(newTrack, newStream);
          }
        }
      }
    },
    []
  );

  return {
    speakingByPeerId,
    initP2P,
    addPeer,
    removePeer,
    teardownAllP2P,
    replaceLocalStream,
    handleSignal,
  };
}
