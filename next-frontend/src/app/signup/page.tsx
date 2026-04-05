'use client'

import { useAuthContext } from '@/context/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import SignUp from '@/components/auth/SignUp'

export default function SignUpPage() {
  const { user, loading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user) return null

  return <SignUp />
}
