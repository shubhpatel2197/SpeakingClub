import React from 'react';
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
          </RouterLink>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleColorMode}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-foreground/70 hover:text-foreground"
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

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
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
