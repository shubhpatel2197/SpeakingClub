'use client'

import * as React from 'react'
import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

type Severity = 'success' | 'error' | 'warning' | 'info'

type SnackbarOptions = {
  message: string
  severity?: Severity
  duration?: number
}

type SnackbarContextType = {
  showSnackbar: (message: string, options?: Omit<SnackbarOptions, 'message'>) => void
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined)

export const useSnackbar = () => {
  const ctx = useContext(SnackbarContext)
  if (!ctx) throw new Error('useSnackbar must be used inside SnackbarProvider')
  return ctx
}

const SEVERITY_CONFIG: Record<
  Severity,
  { bg: string; iconColor: string; icon: React.ElementType }
> = {
  success: {
    bg: 'bg-[#7F9486]',
    iconColor: 'text-white',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-[#D97A5C]',
    iconColor: 'text-white',
    icon: AlertCircle,
  },
  warning: {
    bg: 'bg-[#E7B667]',
    iconColor: 'text-[#0F1115]',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-[#1D2128]',
    iconColor: 'text-[#D97A5C]',
    icon: Info,
  },
}

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<Severity>('success')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSnackbar = useCallback(
    (msg: string, options?: Omit<SnackbarOptions, 'message'>) => {
      if (timerRef.current) clearTimeout(timerRef.current)

      setMessage(msg)
      setSeverity(options?.severity ?? 'success')
      setOpen(true)

      timerRef.current = setTimeout(() => {
        setOpen(false)
      }, options?.duration ?? 4000)
    },
    []
  )

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(false)
  }

  const config = SEVERITY_CONFIG[severity]
  const Icon = config.icon
  const isWarning = severity === 'warning'
  const isInfo = severity === 'info'
  const textColor = isWarning ? 'text-[#0F1115]' : isInfo ? 'text-[#F3EFE8]' : 'text-white'
  const dismissColor = isWarning ? 'text-[#0F1115]/60 hover:text-[#0F1115]' : isInfo ? 'text-[#F3EFE8]/60 hover:text-[#F3EFE8]' : 'text-white/60 hover:text-white'

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}

      <div
        className={`fixed bottom-6 left-1/2 z-[5500] max-w-[420px] w-[calc(100%-2rem)] transition-all duration-300 ease-out ${open
            ? '-translate-x-1/2 translate-y-0 opacity-100'
            : '-translate-x-1/2 translate-y-3 opacity-0 pointer-events-none'
          }`}
      >
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl ${config.bg} ${textColor} shadow-lg ${isInfo ? 'border border-white/[0.08]' : ''}`}
        >
          <Icon className={`w-[18px] h-[18px] shrink-0 ${config.iconColor}`} />
          <span className="flex-1 text-sm font-medium">
            {message}
          </span>
          <button
            onClick={handleClose}
            className={`shrink-0 ${dismissColor} transition-colors cursor-pointer`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </SnackbarContext.Provider>
  )
}
