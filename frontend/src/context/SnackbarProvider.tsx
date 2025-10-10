import * as React from 'react'
import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { Transition } from 'react-transition-group'
import { styled, useTheme } from '@mui/material/styles'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import InfoIcon from '@mui/icons-material/Info'
import CloseIcon from '@mui/icons-material/Close'
import { Snackbar } from '@mui/base/Snackbar'
import type { SnackbarCloseReason } from '@mui/base/useSnackbar'
import type { AlertColor } from '@mui/material'

// ---------- Context setup ----------

type SnackbarOptions = {
  message: string
  severity?: AlertColor
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

// ---------- Colors & styling ----------

const SEVERITY_STYLES: Record<
  AlertColor,
  { bg: string; border: string; color: string; icon: React.ElementType }
> = {
  success: {
    bg: '#E6F4EA',
    border: '#2E7D32',
    color: '#1B5E20',
    icon: CheckCircleIcon,
  },
  error: {
    bg: '#FDECEA',
    border: '#D32F2F',
    color: '#B71C1C',
    icon: ErrorIcon,
  },
  warning: {
    bg: '#FFF4E5',
    border: '#ED6C02',
    color: '#E65100',
    icon: WarningAmberIcon,
  },
  info: {
    bg: '#E3F2FD',
    border: '#0288D1',
    color: '#01579B',
    icon: InfoIcon,
  },
}

const StyledSnackbar = styled(Snackbar)`
  position: fixed;
  z-index: 5500;
  top: 112px;
  right: 16px;
  display: block;           /* don't stretch vertically */
  width: auto;              /* allow content-determined width up to max-width */
  max-width: 560px;
  min-width: 300px;
  height: auto;             /* prevent full-height expansion */
  pointer-events: none;     /* allow clicks through outer container */
  align-items: flex-end;    /* ensure content sits toward bottom if flex is used inside */
`


const SnackbarContent = styled('div')<{ severity: AlertColor }>(({ severity }) => {
  const colors = SEVERITY_STYLES[severity]
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    backgroundColor: colors.bg,
    borderLeft: `6px solid ${colors.border}`,
    borderRadius: 8,
    color: colors.color,
    boxShadow: `0 4px 14px rgba(0,0,0,0.12)`,
    pointerEvents: 'auto', // keep close icon clickable
    transition: 'transform 300ms ease, opacity 300ms ease',
  }
})

const positioningStyles: Record<string, string> = {
  entering: 'translateX(0)',
  entered: 'translateX(0)',
  exiting: 'translateX(150%)',
  exited: 'translateX(150%)',
  unmounted: 'translateX(150%)',
}

// ---------- Provider ----------

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false)
  const [exited, setExited] = useState(true)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const keyRef = useRef(0)

  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<AlertColor>('success')
  const [duration, setDuration] = useState<number>(4000)

  const showSnackbar = useCallback(
    (msg: string, options?: Omit<SnackbarOptions, 'message'>) => {
      setMessage(msg)
      setSeverity(options?.severity ?? 'success')
      setDuration(options?.duration ?? 4000)

      // retrigger animation if already open
      if (open) {
        keyRef.current += 1
        setOpen(false)
        setTimeout(() => setOpen(true), 100)
      } else {
        keyRef.current += 1
        setOpen(true)
      }
    },
    [open]
  )

  const handleClose = (_?: any, reason?: SnackbarCloseReason) => {
    if (reason === 'clickaway') return
    setOpen(false)
  }

  const handleOnEnter = () => setExited(false)
  const handleOnExited = () => setExited(true)

  const Icon = SEVERITY_STYLES[severity].icon

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}

      <StyledSnackbar
        autoHideDuration={duration}
        open={open}
        onClose={handleClose}
        exited={exited}
      >
        <Transition
          timeout={{ enter: 300, exit: 300 }}
          in={open}
          appear
          unmountOnExit
          onEnter={handleOnEnter}
          onExited={handleOnExited}
          nodeRef={nodeRef}
        >
          {(status) => (
            <SnackbarContent
              severity={severity}
              ref={nodeRef}
              style={{
                transform: positioningStyles[status],
                opacity: open ? 1 : 0,
              }}
            >
              <Icon sx={{ flexShrink: 0, fontSize: 24 }} />
              <span
                style={{
                  flex: 1,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                }}
              >
                {message}
              </span>
              <CloseIcon
                sx={{
                  cursor: 'pointer',
                  fontSize: 20,
                  opacity: 0.7,
                  '&:hover': { opacity: 1 },
                }}
                onClick={handleClose}
              />
            </SnackbarContent>
          )}
        </Transition>
      </StyledSnackbar>
    </SnackbarContext.Provider>
  )
}
