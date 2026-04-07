'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import axiosInstance from "../api/axiosInstance";
import { useAuthContext } from "./AuthProvider";
import { getAuthToken } from "../lib/authToken";

export type Member = { id: string; name?: string | null; email?: string; avatar?: string | null; role?: string };
export type Group = {
  id: string;
  description?: string | null;
  language: string;
  level: string;
  max_members?: number | null;
  owner?: { id: string; name?: string | null; email?: string | null };
  memberships?: Member[];
  _count?: { memberships?: number };
  updatedAt?: string;
};

type Ctx = {
  groups: Group[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  optimisticJoin: (groupId: string) => void;
  optimisticLeave: (groupId: string) => void;
};

const GroupsContext = createContext<Ctx | undefined>(undefined);

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuthContext();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const mountedRef = useRef(true);
  const socketRef = useRef<Socket | null>(null);
  const take = 20;

  // No client-side re-sorting — backend returns groups ordered by createdAt desc
  const sortMaybe = useCallback((list: Group[]) => list, []);

  const upsertGroup = useCallback(
    (g: Group) => {
      setGroups((prev) => {
        const idx = prev.findIndex((x) => x.id === g.id);
        if (idx === -1) return sortMaybe([g, ...prev]);
        const next = [...prev];
        next[idx] = { ...next[idx], ...g };
        return sortMaybe(next);
      });
    },
    [sortMaybe]
  );

  const removeGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const addMemberToGroup = useCallback(
    (groupId: string, member: Member) => {
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === groupId);
        if (idx === -1) return prev;
        const group = prev[idx];
        const memberId = member.id;
        const already = group.memberships?.some((m) => m.id === memberId);
        if (already) return prev;
        const next = [...prev];
        next[idx] = {
          ...group,
          memberships: [...(group.memberships || []), member],
          updatedAt: new Date().toISOString(),
        };
        return sortMaybe(next);
      });
    },
    [sortMaybe]
  );

  const removeMemberFromGroup = useCallback(
    (groupId: string, userId: string) => {
      setGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === groupId);
        if (idx === -1) return prev;
        const group = prev[idx];
        const next = [...prev];
        next[idx] = {
          ...group,
          memberships: (group.memberships || []).filter((m) => m.id !== userId),
          updatedAt: new Date().toISOString(),
        };
        return sortMaybe(next);
      });
    },
    [sortMaybe]
  );

  const optimisticJoin = useCallback(
    (groupId: string) => {
      if (!user) return;
      addMemberToGroup(groupId, { id: user.id, name: user.name, email: user.email, avatar: user.avatar ?? null });
    },
    [user, addMemberToGroup]
  );

  const optimisticLeave = useCallback(
    (groupId: string) => {
      if (!user) return;
      removeMemberFromGroup(groupId, user.id);
    },
    [user, removeMemberFromGroup]
  );

  const fetchPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const params: any = { take };
        if (!opts?.reset && cursor) params.cursor = cursor;
        const res = await axiosInstance.get("/api/groups", {
          params,
          withCredentials: true,
        });
        const data: { groups: Group[] } = res.data;

        if (opts?.reset) {
          setGroups(sortMaybe(data.groups));
        } else {
          setGroups((prev) => {
            const ids = new Set(prev.map((g) => g.id));
            const appended = data.groups.filter((g) => !ids.has(g.id));
            return sortMaybe(prev.concat(appended));
          });
        }

        if (data.groups.length < take) {
          setHasMore(false);
        } else {
          const last = data.groups[data.groups.length - 1];
          setCursor(last?.id ?? null);
          setHasMore(Boolean(last));
        }
      } catch (err: any) {
        setError(err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [cursor, take, sortMaybe]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setGroups([]);
      setCursor(null);
      setHasMore(true);
      return;
    }
    setCursor(null);
    setHasMore(true);
    fetchPage({ reset: true });
  }, [authLoading, user?.id, fetchPage]);

  // Use refs so the socket effect doesn't re-run when callbacks change
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const upsertGroupRef = useRef(upsertGroup);
  upsertGroupRef.current = upsertGroup;
  const addMemberRef = useRef(addMemberToGroup);
  addMemberRef.current = addMemberToGroup;
  const removeMemberRef = useRef(removeMemberFromGroup);
  removeMemberRef.current = removeMemberFromGroup;
  const removeGroupRef = useRef(removeGroup);
  removeGroupRef.current = removeGroup;

  useEffect(() => {
    if (authLoading || !user) return;

    const socket = io(process.env.NEXT_PUBLIC_API_BASE_URL || "/", {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: {
        token: getAuthToken(),
      },
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[GroupSocket] connected", socket.id);
      socket.emit("groups:subscribe");
    });

    socket.on("reconnect", () => {
      console.log("[GroupSocket] reconnected");
      socket.emit("groups:subscribe");
    });

    socket.on("groups:refresh", () => {
      setCursor(null);
      setHasMore(true);
      fetchPageRef.current({ reset: true });
    });

    socket.on("groups:created", ({ group }: { group: Group }) => {
      if (group) upsertGroupRef.current(group);
    });

    socket.on("groups:memberJoined", ({ groupId, member }: { groupId: string; member: Member }) => {
      if (groupId && member) addMemberRef.current(groupId, member);
    });

    socket.on("groups:memberLeft", ({ groupId, userId }: { groupId: string; userId: string }) => {
      if (groupId && userId) removeMemberRef.current(groupId, userId);
    });

    socket.on("groups:remove", ({ id }: { id: string }) => {
      if (id) removeGroupRef.current(id);
    });

    return () => {
      try {
        socket.emit("groups:unsubscribe");
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [authLoading, user?.id]);

  const refresh = useCallback(async () => {
    setCursor(null);
    setHasMore(true);
    await fetchPage({ reset: true });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    await fetchPage();
  }, [fetchPage, hasMore]);

  const value = useMemo(
    () => ({ groups, loading, error, refresh, loadMore, hasMore, optimisticJoin, optimisticLeave }),
    [groups, loading, error, refresh, loadMore, hasMore, optimisticJoin, optimisticLeave]
  );

  return (
    <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>
  );
}

export function useGroups() {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error("useGroups must be used within a GroupsProvider");
  return ctx;
}
