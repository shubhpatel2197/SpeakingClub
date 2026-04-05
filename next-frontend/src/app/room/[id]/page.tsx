'use client'

import { useAuthContext } from '@/context/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { CurrentGroupProvider } from '@/context/CurrentGroupContext'
import dynamic from 'next/dynamic'

const Room = dynamic(() => import('@/views/Room'), { ssr: false })

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !id) return null

  return (
    <CurrentGroupProvider roomId={id} fallback={<div className="p-4">Loading room data…</div>}>
      <Suspense fallback={<div className="p-4">Loading room…</div>}>
        <Room />
      </Suspense>
    </CurrentGroupProvider>
  )
}
