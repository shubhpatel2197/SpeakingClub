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
import { useColorMode } from '../../context/ColorModeContext';
import { Button } from './button';
import { Menu, X, Sun, Moon } from 'lucide-react';

export default function NavBar() {
  const { user, loading, signOut } = useAuthContext();
  const { mode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/signin', { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 w-full glass">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <RouterLink
            to="/"
            className="font-display text-xl font-bold gradient-text hover:opacity-80 transition-opacity no-underline"
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
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground/80 max-w-[200px] truncate">
                  {user?.name ?? user?.email}
                </span>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/signin')}>
                  Sign in
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/signup')}>
                  Sign up
                </Button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleColorMode}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-foreground/70"
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-foreground"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-border glass">
          <div className="px-4 py-3 space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : user ? (
              <>
                <p className="text-sm font-medium text-foreground/80 truncate">
                  {user.name ?? user.email}
                </p>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => { setMenuOpen(false); navigate('/signin'); }}
                >
                  Sign in
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => { setMenuOpen(false); navigate('/signup'); }}
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
