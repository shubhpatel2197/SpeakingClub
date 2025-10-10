import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import AppTheme from '../theme/AppTheme'

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
  const [mode, setMode] = useState<ColorMode>(() => {
    try {
      const saved = localStorage.getItem('color-mode') as ColorMode | null
      return saved ?? 'light'
    } catch {
      return 'light'
    }
  })

  const toggleColorMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem('color-mode', next)
      } catch {}
      return next
    })
  }

  const value = useMemo(() => ({ mode, toggleColorMode }), [mode])

  // wrap children with AppTheme and provide context
  return (
    <ColorModeContext.Provider value={value}>
      <AppTheme mode={mode}>{children}</AppTheme>
    </ColorModeContext.Provider>
  )
}
