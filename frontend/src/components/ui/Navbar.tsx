import React from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthProvider'
import ColorModeSelect from '../../theme/ColorModeSelect'

export default function NavBar() {
  const { user, loading, signOut } = useAuthContext()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin', { replace: true })
  }

  return (
    <AppBar position="sticky" color="transparent" elevation={0} sx={{ mb: 3 }}>
      <Toolbar>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{ textDecoration: 'none', color: 'inherit', mr: 2 }}
        >
          MyApp
        </Typography>

        <Box sx={{ flex: 1 }} />

        {/* color mode toggle (optional) */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', mr: 1 }}>
          <ColorModeSelect />
        </Box>

        {loading ? (
          <Typography variant="body2">Loading...</Typography>
        ) : user ? (
          <>
            <Typography
              variant="body2"
              sx={{ mr: 2, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {user.name ?? user.email}
            </Typography>
            <Button color="inherit" onClick={handleSignOut}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Button component={RouterLink} to="/signin" color="inherit">
              Sign in
            </Button>
            <Button component={RouterLink} to="/signup" color="inherit" variant="outlined" sx={{ ml: 1 }}>
              Sign up
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}
