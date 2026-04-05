'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type ColorMode = 'light' | 'dark'

interface ColorModeContextValue {
  mode: ColorMode
  toggleColorMode: () => void
}
const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined)
export const useColorMode = () => {
  const ctx = useContext(ColorModeContext)
  if (!ctx) throw new Error('useColorMode must be used inside ColorModeProvider')
  return ctx
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>('dark')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('color-mode') as ColorMode | null
      if (saved) setMode(saved)
    } catch {
      // ignore
    }
  }, [])

  // Sync class on <html>
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(mode)
  }, [mode])

  const toggleColorMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem('color-mode', next)
      } catch { }
      return next
    })
  }

  const value = useMemo(() => ({ mode, toggleColorMode }), [mode])

  return (
    <ColorModeContext.Provider value={value}>
      {children}
    </ColorModeContext.Provider>
  )
}
