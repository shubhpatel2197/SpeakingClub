// frontend/src/hooks/useGroups.ts
import { useCallback, useEffect, useState } from 'react'
import axiosInstance from '../api/axiosInstance'

export type Member = {
  id: string;
  name?: string | null;
  email?: string;
};

export type Group = {
  id: string
  description?: string | null
  language: string
  level: string
  max_members?: number | null
  owner?: { id: string; name?: string | null; email?: string | null }
  memberships?: Member[]
  _count?: { memberships?: number }
}

type UseGroupsReturn = {
  groups: Group[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  hasMore: boolean
}

export function useGroups(initialTake = 20): UseGroupsReturn {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const take = initialTake

  const fetchPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      setLoading(true)
      setError(null)
      try {
        const params: any = { take }
        if (!opts?.reset && cursor) params.cursor = cursor
        const res = await axiosInstance.get('/groups', { params })
        const data: { groups: Group[] } = res.data
        if (opts?.reset) {
          setGroups(data.groups)
        } else {
          // append, but avoid duplicates
          setGroups((prev) => {
            const ids = new Set(prev.map((g) => g.id))
            const appended = data.groups.filter((g) => !ids.has(g.id))
            return prev.concat(appended)
          })
        }

        // decide new cursor/hasMore
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
        setLoading(false)
      }
    },
    [cursor, take]
  )

  // initial load
  useEffect(() => {
    // fetch first page
    setCursor(null)
    setHasMore(true)
    fetchPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
