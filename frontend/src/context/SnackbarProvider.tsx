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
  { bg: string; border: string; text: string; icon: React.ElementType }
> = {
  success: {
    bg: 'bg-green-900/80',
    border: 'border-l-green-500',
    text: 'text-green-200',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-900/80',
    border: 'border-l-red-500',
    text: 'text-red-200',
    icon: AlertCircle,
  },
  warning: {
    bg: 'bg-amber-900/80',
    border: 'border-l-amber-500',
    text: 'text-amber-200',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-900/80',
    border: 'border-l-blue-500',
    text: 'text-blue-200',
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
      // Clear any existing timer
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

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}

      {/* Snackbar */}
      <div
        className={`fixed top-24 right-4 z-[5500] max-w-[560px] min-w-[300px] transition-all duration-300 ${open
            ? 'translate-x-0 opacity-100'
            : 'translate-x-[150%] opacity-0 pointer-events-none'
          }`}
      >
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border-l-[6px] ${config.bg} ${config.border} ${config.text} shadow-xl backdrop-blur-sm`}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-sm font-medium font-sans">
            {message}
          </span>
          <button
            onClick={handleClose}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </SnackbarContext.Provider>
  )
}
