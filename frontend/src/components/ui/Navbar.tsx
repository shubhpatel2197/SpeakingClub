import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Container,
  Menu,
  MenuItem,
  useMediaQuery,
  Link,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthProvider';

export default function NavBar() {
  const { user, loading, signOut } = useAuthContext();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleSignOut = async () => {
    handleMenuClose();
    await signOut();
    navigate('/signin', { replace: true });
  };

  const textColor =
    theme.palette.mode === 'dark' ? theme.palette.text.primary : 'rgba(0,0,0,0.85)';

  const UserLabel = (
    <Typography
      variant="body2"
      sx={{
        maxWidth: 200,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        mr: 2,
        color: textColor,
        fontWeight: 500,
      }}
      title={user?.name || user?.email || ''}
    >
      {user?.name ?? user?.email}
    </Typography>
  );

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backdropFilter: 'blur(8px)',
        backgroundColor: (t) =>
          t.palette.mode === 'dark'
            ? alpha(t.palette.background.default, 0.7)
            : alpha('#ffffff', 0.9),
        borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.9)}`,
        color: textColor,
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: { xs: 56, md: 64 } }}>
          {/* Brand */}
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              textDecoration: 'none',
              color: textColor,
              fontWeight: 700,
              letterSpacing: 0.2,
              mr: 2,
            }}
          >
            SpeakingClub
          </Typography>

          {user && (
            <Button
              component={RouterLink}
              to="/random"
              startIcon={<ShuffleIcon sx={{ fontSize: 18 }} />}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 50,
                px: 2,
                py: 0.5,
                textTransform: 'none',
                fontSize: '0.85rem',
                boxShadow: '0 2px 12px rgba(102, 126, 234, 0.3)',
                display: { xs: 'none', md: 'inline-flex' },
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.45)',
                },
              }}
            >
              Random Chat
            </Button>
          )}

          <Box sx={{ flex: 1 }} />

          {loading ? (
            <Typography variant="body2" sx={{ color: textColor }}>
              Loading...
            </Typography>
          ) : isMdUp ? (
            // Desktop/tablet
            user ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {UserLabel}
                <Button color="inherit" onClick={handleSignOut} sx={{ color: textColor }}>
                  Sign out
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  component={RouterLink}
                  to="/signin"
                  sx={{ color: textColor }}
                >
                  Sign in
                </Button>
                <Button
                  component={RouterLink}
                  to="/signup"
                  variant="outlined"
                  sx={{
                    borderColor: alpha(textColor, 0.4),
                    color: textColor,
                    '&:hover': { borderColor: textColor },
                  }}
                >
                  Sign up
                </Button>
              </Box>
            )
          ) : (
            // Mobile
            <Box>
              {user && (
                <Typography
                  variant="body2"
                  sx={{
                    maxWidth: 140,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'inline-block',
                    mr: 1,
                    color: textColor,
                  }}
                  title={user?.name || user?.email || ''}
                >
                  {user?.name ?? user?.email}
                </Typography>
              )}
              <IconButton
                edge="end"
                aria-label="menu"
                onClick={handleMenuOpen}
                sx={{ color: textColor }}
              >
                <MenuIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                keepMounted
              >
                {user ? (
                  <>
                    <MenuItem disabled>{user.name ?? user.email}</MenuItem>
                    <MenuItem
                      onClick={() => {
                        handleMenuClose();
                        navigate('/random');
                      }}
                    >
                      Random Chat
                    </MenuItem>
                    <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem
                      onClick={() => {
                        handleMenuClose();
                        navigate('/signin');
                      }}
                    >
                      Sign in
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        handleMenuClose();
                        navigate('/signup');
                      }}
                    >
                      Sign up
                    </MenuItem>
                  </>
                )}
              </Menu>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
