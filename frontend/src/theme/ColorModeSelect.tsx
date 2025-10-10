import IconButton from '@mui/material/IconButton'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import Tooltip from '@mui/material/Tooltip'
import { useColorMode } from '../context/ColorModeContext'

export default function ColorModeSelect(props: any) {
  const { mode, toggleColorMode } = useColorMode()
  return (
    <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
      <IconButton color="inherit" onClick={toggleColorMode} {...props}>
        {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
      </IconButton>
    </Tooltip>
  )
}
