import { useEffect, useState } from 'react'
import axiosInstance from '../api/axiosInstance'

interface User {
  id: string
  email: string
  name?: string
  createdAt?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    axiosInstance
      .get('/user/me')
      .then((res) => {
        if (isMounted) setUser(res.data.user)
      })
      .catch(() => {
        if (isMounted) setUser(null)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return { user, loading }
}
