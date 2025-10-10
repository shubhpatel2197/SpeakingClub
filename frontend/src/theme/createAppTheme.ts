// frontend/src/theme/createAppTheme.ts
import { createTheme } from '@mui/material/styles'
import type { ThemeOptions } from '@mui/material/styles'
import { inputsCustomizations } from './customizations/inputs'
import { dataDisplayCustomizations } from './customizations/dataDisplay'
import { feedbackCustomizations } from './customizations/feedback'
import { navigationCustomizations } from './customizations/navigation'
import { surfacesCustomizations } from './customizations/surfaces'
import { colorSchemes, typography, shadows, shape } from './themePrimitives'

export function createAppTheme(mode: 'light' | 'dark') {
  const basePalette =
    mode === 'light'
      ? {
          mode,
          primary: {
            main: '#1976d2',
            contrastText: '#fff',
          },
          secondary: {
            main: '#0288d1',
          },
          background: {
            default: 'hsl(210, 100%, 97%)',
            paper: '#ffffff',
          },
          text: {
            primary: '#0d1117', // dark text for light bg
            secondary: '#3b3b3b',
          },
        }
      : {
          mode,
          primary: {
            main: '#90caf9',
          },
          secondary: {
            main: '#64b5f6',
          },
          background: {
            default: 'hsl(220, 30%, 8%)',
            paper: 'hsl(220, 25%, 10%)',
          },
          text: {
            primary: '#ffffff',
            secondary: '#bdbdbd',
          },
        }

  const options: ThemeOptions = {
    cssVariables: {
      colorSchemeSelector: 'data-mui-color-scheme',
      cssVarPrefix: 'template',
    },
    typography,
    shadows,
    shape,
    palette: basePalette,
    components: {
      ...inputsCustomizations,
      ...dataDisplayCustomizations,
      ...feedbackCustomizations,
      ...navigationCustomizations,
      ...surfacesCustomizations,
    },
  }

  return createTheme(options)
}
