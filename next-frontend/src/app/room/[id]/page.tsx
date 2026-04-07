'use client'

import { useAuthContext } from '@/context/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import { useEffect } from 'react'
import { CurrentGroupProvider } from '@/context/CurrentGroupContext'
import dynamic from 'next/dynamic'

const Room = dynamic(() => import('@/views/Room'), {
  ssr: false,
  loading: () => null,
})

export default function RoomPage() {
  const { user, loading } = useAuthContext()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && !id) {
      router.replace('/')
    }
  }, [id, loading, router])

  if (loading || !user || !id) return null

  return (
    <CurrentGroupProvider roomId={id}>
      <Room />
    </CurrentGroupProvider>
  )
}
