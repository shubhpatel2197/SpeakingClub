'use client'

import { useEffect, useRef } from 'react'

export default function BetterbugsBoot() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    import('@betterbugs/web-sdk').then((mod) => {
      const Betterbugs =
        (mod as { default?: unknown }).default ??
        (mod as { Betterbugs?: unknown }).Betterbugs ??
        mod
      window.bb = new (Betterbugs as new (opts: {
        apiKey: string
        mode: 'development' | 'production'
      }) => Window['bb'])({
        apiKey: '3e14a8747bb22638c785b5631b5144ee',
        mode: 'production',
      })
    })
  }, [])

  return null
}
