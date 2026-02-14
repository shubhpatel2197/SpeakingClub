import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/AuthProvider";
import { useMediasoup } from "./useMediasoup";

export type RandomChatState =
  | "idle"
  | "searching"
  | "matched"
  | "partner-left";

export function useRandomChat() {
  const mediasoup = useMediasoup();
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [state, setState] = useState<RandomChatState>("idle");
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  const [chatDuration, setChatDuration] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRequeueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);

  // Create/get the signalling socket (separate from the mediasoup socket)
  const getSocket = useCallback((): Socket => {
    if (socketRef.current?.connected) return socketRef.current;

    const s = io("/", {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = s;

    s.on("randomChat:matched", ({ roomId, partnerName: pName }: { roomId: string; partnerName: string }) => {
      currentRoomIdRef.current = roomId;
      setPartnerName(pName);
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

      // Join the mediasoup room for audio/video/data
      mediasoup.joinRoom(roomId);
    });

    s.on("randomChat:waiting", () => {
      setState("searching");
    });

    s.on("randomChat:partnerLeft", () => {
      setState("partner-left");

      // Stop chat timer
      if (chatTimerRef.current) {
        clearInterval(chatTimerRef.current);
        chatTimerRef.current = null;
      }

      // Cleanup mediasoup
      mediasoup.cleanupAndDisconnect();
      currentRoomIdRef.current = null;

      // Auto-requeue after 3 seconds
      autoRequeueTimerRef.current = setTimeout(() => {
        if (socketRef.current?.connected) {
          setSearchTime(0);
          searchTimerRef.current = setInterval(() => {
            setSearchTime((prev) => prev + 1);
          }, 1000);
          socketRef.current.emit("randomChat:join");
          setState("searching");
        }
      }, 3000);
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
    setSearchTime(0);
    setChatDuration(0);

    navigate("/", { replace: true });
  }, [mediasoup, navigate]);

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
    searchTime,
    chatDuration,
    startSearching,
    cancelSearch,
    next,
    leave,
    // Forward mediasoup controls
    toggleMic: mediasoup.toggleMic,
    micOn: mediasoup.micOn,
    messages: mediasoup.messages,
    sendChat: mediasoup.sendChat,
    setTyping: mediasoup.setTyping,
    participants: mediasoup.participants,
    isSharingScreen: mediasoup.isSharingScreen,
    screenSharerId: mediasoup.screenSharerId,
    screenSharerName: mediasoup.screenSharerName,
  };
}
