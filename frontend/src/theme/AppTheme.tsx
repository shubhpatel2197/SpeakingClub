import * as React from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { GlobalStyles } from '@mui/material'
import type { ThemeOptions } from '@mui/material/styles'
import { createAppTheme } from './createAppTheme'

interface AppThemeProps {
  children: React.ReactNode
  disableCustomTheme?: boolean
  mode?: 'light' | 'dark'
  themeComponents?: ThemeOptions['components']
}

export default function AppTheme(props: AppThemeProps) {
  const { children, disableCustomTheme, mode = 'light' } = props

  // build theme whenever mode changes
  const theme = React.useMemo(() => {
    if (disableCustomTheme) return undefined as any
    return createAppTheme(mode)
  }, [disableCustomTheme, mode])

  if (disableCustomTheme) {
    return <>{children}</>
  }

  const globalBgLight = {
    backgroundImage:
      'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  }

  const globalBgDark = {
    backgroundImage:
      'radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles
        styles={(theme) => ({
          html: { height: '100%' },
          body: {
            minHeight: '100%',
            color: theme.palette.text.primary,
            margin: 0,
            ...(theme.palette?.mode === 'dark' ? globalBgDark : globalBgLight),
            display: 'block',
          },
          '#root': { minHeight: '100%' },
          'body > #root > div': { minHeight: '100%' },
        })}
      />
      {children}
    </ThemeProvider>
  )
}
