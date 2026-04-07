'use client'

import { useEffect } from 'react'

export default function BetterBugs() {
  useEffect(() => {
    import('@betterbugs/web-sdk').then(({ default: Betterbugs }) => {
      new Betterbugs({ apiKey: '312093997c92db930b951c487a33fe57' })
    })
  }, [])

  return null
}
