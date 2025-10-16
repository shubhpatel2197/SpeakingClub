// frontend/src/hooks/useGroups.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../api/axiosInstance'
import { io, Socket } from 'socket.io-client'

export type Member = {
  id: string
  name?: string | null
  email?: string
}

export type Group = {
  id: string
  description?: string | null
  language: string
  level: string
  max_members?: number | null
  owner?: { id: string; name?: string | null; email?: string | null }
  memberships?: Member[]
  _count?: { memberships?: number }
  updatedAt?: string
}

type UseGroupsReturn = {
  groups: Group[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  hasMore: boolean
}

const SOCKET_PATH = '/socket.io' // same as backend
const SOCKET_URL = 'http://localhost:4000' // empty => same origin. Set to 'http://localhost:4000' if backend is separate in dev.

export function useGroups(initialTake = 20): UseGroupsReturn {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const mountedRef = useRef(true)
  const socketRef = useRef<Socket | null>(null)
  const take = initialTake

  // merge helper: upsert by id, keep most recent first based on updatedAt if available
  const upsertGroup = useCallback((g: Group) => {
    setGroups(prev => {
      const idx = prev.findIndex(x => x.id === g.id)
      if (idx === -1) {
        // add to top
        const next = [g, ...prev]
        return sortMaybe(next)
      } else {
        const next = [...prev]
        // shallow merge (keep any fields from server)
        next[idx] = { ...next[idx], ...g }
        return sortMaybe(next)
      }
    })
  }, [])

  // remove helper
  const removeGroup = useCallback((id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id))
  }, [])

  // optional sort by updatedAt desc if present
  const sortMaybe = useCallback((list: Group[]) => {
    const hasUpdatedAt = list.some(g => !!g.updatedAt)
    if (!hasUpdatedAt) return list
    return [...list].sort((a, b) => {
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0
      return tb - ta
    })
  }, [])

  const fetchPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      setLoading(true)
      setError(null)
      try {
        const params: any = { take }
        if (!opts?.reset && cursor) params.cursor = cursor
        const res = await axiosInstance.get('/groups', { params, withCredentials: true })
        const data: { groups: Group[] } = res.data

        if (opts?.reset) {
          setGroups(sortMaybe(data.groups))
        } else {
          setGroups(prev => {
            const ids = new Set(prev.map(g => g.id))
            const appended = data.groups.filter(g => !ids.has(g.id))
            return sortMaybe(prev.concat(appended))
          })
        }

        if (data.groups.length < take) {
          setHasMore(false)
        } else {
          const last = data.groups[data.groups.length - 1]
          setCursor(last?.id ?? null)
          setHasMore(Boolean(last))
        }
      } catch (err: any) {
        setError(err)
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [cursor, take, sortMaybe]
  )

  // initial load
  useEffect(() => {
    mountedRef.current = true
    setCursor(null)
    setHasMore(true)
    fetchPage({ reset: true })
    return () => {
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // socket wiring
  useEffect(() => {
    // open socket (shares the same auth cookie)
    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      withCredentials: true,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      // subscribe to global groups channel
      socket.emit('groups:subscribe')
    })

    // ask clients to refresh list (simple & consistent)
    socket.on('groups:refresh', () => {
      // reset pagination and refetch first page
      setCursor(null)
      setHasMore(true)
      fetchPage({ reset: true })
    })

    // upsert a single group (create/update)
    socket.on('groups:upsert', ({ group }: { group: Group }) => {
      console.log('groups:upsert', group)
      if (group) upsertGroup(group)
    })

    // remove a group (deleted)
    socket.on('groups:remove', ({ id }: { id: string }) => {
      console.log('groups:remove', id)
      if (id) removeGroup(id)
    })

    socket.on('disconnect', () => {
      // no-op; optional: backoff reconnect handling here
    })

    return () => {
      try {
        socket.emit('groups:unsubscribe')
        socket.disconnect()
      } catch {}
      socketRef.current = null
    }
  }, [fetchPage, removeGroup, upsertGroup])

  const refresh = useCallback(async () => {
    setCursor(null)
    setHasMore(true)
    await fetchPage({ reset: true })
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (!hasMore) return
    await fetchPage()
  }, [fetchPage, hasMore])

  return { groups, loading, error, refresh, loadMore, hasMore }
}
