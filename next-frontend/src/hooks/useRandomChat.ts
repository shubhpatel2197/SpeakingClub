'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { useAuthContext } from "../context/AuthProvider";
import { useMediasoup } from "./useMediasoup";
import { getAuthToken } from "../lib/authToken";

export type RandomChatState =
  | "idle"
  | "searching"
  | "matched"
  | "partner-left";

export function useRandomChat() {
  const mediasoup = useMediasoup();
  const { user } = useAuthContext();
  const router = useRouter();

  const [state, setState] = useState<RandomChatState>("idle");
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  const [chatDuration, setChatDuration] = useState(0);
  const [lastMessages, setLastMessages] = useState<any[]>([]);
  const [lastPartnerAvatar, setLastPartnerAvatar] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRequeueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const messagesRef = useRef<any[]>([]);
  const participantsRef = useRef<any[]>([]);
  const selfIdRef = useRef<string | undefined>(undefined);
  useEffect(() => { messagesRef.current = mediasoup.messages; }, [mediasoup.messages]);
  const lastPartnerAvatarRef = useRef<string | null>(null);
  useEffect(() => {
    participantsRef.current = mediasoup.participants;
    const partner = mediasoup.participants.find(
      (x: any) => (x.id || x.userId) !== selfIdRef.current
    );
    if (partner?.avatar) lastPartnerAvatarRef.current = partner.avatar;
  }, [mediasoup.participants]);
  useEffect(() => { selfIdRef.current = user?.id; }, [user?.id]);

  // Create/get the signalling socket (separate from the mediasoup socket)
  const getSocket = useCallback((): Socket => {
    if (socketRef.current?.connected) return socketRef.current;

    const s = io(process.env.NEXT_PUBLIC_API_BASE_URL || "/", {
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
    socketRef.current = s;

    s.on("randomChat:matched", ({ roomId, partnerId: pId, partnerName: pName }: { roomId: string; partnerId: string; partnerName: string }) => {
      currentRoomIdRef.current = roomId;
      setRoomId(roomId);
      setPartnerName(pName);
      setPartnerId(pId);
      lastPartnerAvatarRef.current = null;
      setState("matched");

      // Stop search timer, start chat timer
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      setSearchTime(0);
      setChatDuration(0);
      chatTimerRef.current = setInterval(() => {
        setChatDuration((prev) => prev + 1);
      }, 1000);

      // Join the mediasoup room for audio/video/data, reusing the same socket
      mediasoup.joinRoom(roomId, s);
    });

    s.on("randomChat:waiting", () => {
      setState("searching");
    });

    s.on("randomChat:partnerLeft", () => {
      // Snapshot chat history + partner avatar BEFORE cleanup wipes them
      setLastMessages([...messagesRef.current]);
      setLastPartnerAvatar(lastPartnerAvatarRef.current);

      setState("partner-left");

      // Stop chat timer
      if (chatTimerRef.current) {
        clearInterval(chatTimerRef.current);
        chatTimerRef.current = null;
      }

      // Cleanup mediasoup
      mediasoup.cleanupAndDisconnect();
      currentRoomIdRef.current = null;
      setRoomId(null);

      // No auto-requeue — user manually presses Start
    });

    return s;
  }, [mediasoup]);

  const startSearching = useCallback(() => {
    const s = getSocket();
    setState("searching");
    setSearchTime(0);
    searchTimerRef.current = setInterval(() => {
      setSearchTime((prev) => prev + 1);
    }, 1000);
    s.emit("randomChat:join");
  }, [getSocket]);

  const next = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected) return;

    // Stop chat timer
    if (chatTimerRef.current) {
      clearInterval(chatTimerRef.current);
      chatTimerRef.current = null;
    }

    // Cleanup mediasoup for the current room
    mediasoup.cleanupAndDisconnect();
    currentRoomIdRef.current = null;
    setRoomId(null);

    setState("searching");
    setSearchTime(0);
    searchTimerRef.current = setInterval(() => {
      setSearchTime((prev) => prev + 1);
    }, 1000);

    s.emit("randomChat:next");
  }, [mediasoup]);

  const leave = useCallback(() => {
    // Clear all timers
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (chatTimerRef.current) {
      clearInterval(chatTimerRef.current);
      chatTimerRef.current = null;
    }
    if (autoRequeueTimerRef.current) {
      clearTimeout(autoRequeueTimerRef.current);
      autoRequeueTimerRef.current = null;
    }

    const s = socketRef.current;
    if (s?.connected) {
      s.emit("randomChat:leave");
    }

    mediasoup.cleanupAndDisconnect();
    currentRoomIdRef.current = null;

    // Disconnect signalling socket
    try { s?.disconnect(); } catch {}
    socketRef.current = null;

    setState("idle");
    setPartnerName(null);
    setPartnerId(null);
    setRoomId(null);
    setSearchTime(0);
    setChatDuration(0);

    router.replace("/random");
  }, [mediasoup, router]);

  const cancelSearch = useCallback(() => {
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    const s = socketRef.current;
    if (s?.connected) {
      s.emit("randomChat:leave");
    }

    try { s?.disconnect(); } catch {}
    socketRef.current = null;

    setState("idle");
    setSearchTime(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      if (chatTimerRef.current) clearInterval(chatTimerRef.current);
      if (autoRequeueTimerRef.current) clearTimeout(autoRequeueTimerRef.current);

      const s = socketRef.current;
      if (s?.connected) {
        s.emit("randomChat:leave");
        s.disconnect();
      }
    };
  }, []);

  return {
    state,
    partnerName,
    partnerId,
    roomId,
    searchTime,
    chatDuration,
    startSearching,
    cancelSearch,
    next,
    leave,
    // Forward chat controls from mediasoup data channel
    messages: mediasoup.messages,
    sendChat: mediasoup.sendChat,
    setTyping: mediasoup.setTyping,
    participants: mediasoup.participants,
    lastMessages,
    lastPartnerAvatar,
    clearLastSnapshot: () => { setLastMessages([]); setLastPartnerAvatar(null); },
  };
}
