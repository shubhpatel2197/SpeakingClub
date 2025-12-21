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

export type Member = { id: string; name?: string | null; email?: string };
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
};

const GroupsContext = createContext<Ctx | undefined>(undefined);

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuthContext();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const mountedRef = useRef(true);
  const socketRef = useRef<Socket | null>(null);
  const take = 20;

  const sortMaybe = useCallback((list: Group[]) => {
    const hasUpdatedAt = list.some((g) => !!g.updatedAt);
    if (!hasUpdatedAt) return list;
    return [...list].sort((a, b) => {
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return tb - ta;
    });
  }, []);

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

  // Initial (and auth-change) load — wait for auth to be ready
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return; // wait for auth provider to finish
    if (!user) {
      // signed out
      setGroups([]);
      setCursor(null);
      setHasMore(true);
      return;
    }
    setCursor(null);
    setHasMore(true);
    fetchPage({ reset: true });
  }, [authLoading, user?.id, fetchPage]);

  // Socket wiring (single connection app-wide)
  useEffect(() => {
    if (authLoading || !user) return;

    const socket = io("/", {
      path: "/socket.io",
      transports: ["websocket"],
      withCredentials: true,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      // console.log("Connected to groups socket");
      socket.emit("groups:subscribe");
    });

    socket.on("groups:refresh", () => {
      setCursor(null);
      setHasMore(true);
      fetchPage({ reset: true });
    });

    socket.on("groups:upsert", ({ group }: { group: Group }) => {
      if (group) upsertGroup(group);
    });

    socket.on("groups:remove", ({ id }: { id: string }) => {
      if (id) removeGroup(id);
    });

    return () => {
      try {
        socket.emit("groups:unsubscribe");
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [authLoading, user?.id, fetchPage, removeGroup, upsertGroup]);

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
    () => ({ groups, loading, error, refresh, loadMore, hasMore }),
    [groups, loading, error, refresh, loadMore, hasMore]
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
