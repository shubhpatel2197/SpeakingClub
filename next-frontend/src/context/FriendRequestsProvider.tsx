'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { useAuthContext } from "./AuthProvider";

type FriendRequest = {
  id: string;
  fromId: string;
  name: string | null;
  avatar: string | null;
  createdAt: string;
};

type FriendRequestsContextValue = {
  requests: FriendRequest[];
  count: number;
  fetchRequests: () => Promise<void>;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
};

const POLL_INTERVAL = 5000;

const FriendRequestsContext = createContext<FriendRequestsContextValue | undefined>(undefined);

export function FriendRequestsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [count, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/api/friends/requests/count");
      setCount(data.count ?? 0);
    } catch {}
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/api/friends/requests");
      setRequests(data.requests || []);
      setCount(data.requests?.length ?? 0);
    } catch {}
  }, []);

  // Poll count every 5s when logged in
  useEffect(() => {
    if (!user) {
      setCount(0);
      setRequests([]);
      return;
    }
    fetchCount();
    timerRef.current = setInterval(fetchCount, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCount, user]);

  const accept = useCallback(async (requestId: string) => {
    try {
      await axiosInstance.post("/api/friends/accept", { requestId });
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setCount((prev) => Math.max(0, prev - 1));
    } catch {}
  }, []);

  const reject = useCallback(async (requestId: string) => {
    try {
      await axiosInstance.delete(`/api/friends/${requestId}`);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setCount((prev) => Math.max(0, prev - 1));
    } catch {}
  }, []);

  return (
    <FriendRequestsContext.Provider value={{ requests, count, fetchRequests, accept, reject }}>
      {children}
    </FriendRequestsContext.Provider>
  );
}

export function useFriendRequests() {
  const ctx = useContext(FriendRequestsContext);
  if (!ctx) throw new Error("useFriendRequests must be used inside FriendRequestsProvider");
  return ctx;
}
