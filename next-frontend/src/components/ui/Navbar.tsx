'use client'

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '../../context/AuthProvider';
import { Button } from './button';
import { Menu, X, Shuffle, LogOut, Settings, Bell } from 'lucide-react';
import { useFriendRequests } from '../../hooks/useFriendRequests';

function UserAvatar({ user, size = 28 }: { user: { name?: string | null; email?: string; avatar?: string | null }; size?: number }) {
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className="rounded-full object-cover bg-secondary"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = (user.name || user.email || 'U')
    .split(' ')
    .map((t) => (t ? t[0] : ''))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="rounded-full bg-primary/15 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span className="text-primary font-semibold" style={{ fontSize: size * 0.38 }}>
        {initials}
      </span>
    </div>
  );
}

export default function NavBar() {
  const { user, loading, signOut } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const { count: friendReqCount } = useFriendRequests();

  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/signin');
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0F1115]/90 backdrop-blur-lg border-b border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="group flex items-center gap-3 no-underline"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <Image
                src="/download.png"
                alt="SpeakingClub logo"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
            </div>
            <div className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-[1.2rem] font-semibold tracking-[0.01em] text-foreground transition-colors group-hover:text-primary sm:text-[1.28rem]">
                SpeakingClub
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            {loading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/random')}
                  className="h-10 rounded-full px-4 text-muted-foreground hover:text-foreground"
                >
                  <Shuffle className="w-3.5 h-3.5 mr-1.5" />
                  Random Chat
                </Button>

                <button
                  onClick={() => router.push('/random')}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <Bell className="w-4 h-4" />
                  {friendReqCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 animate-pulse">
                      {friendReqCount}
                    </span>
                  )}
                </button>

                <div className="mx-1 h-5 w-px bg-border" />

                <button
                  onClick={() => router.push('/profile')}
                  className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors hover:bg-white/5"
                >
                  <UserAvatar user={user} size={28} />
                  <span className="max-w-[160px] truncate text-sm font-medium text-foreground/70">
                    {user?.name ?? user?.email}
                  </span>
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="ml-1 h-10 w-10 rounded-full p-0 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {pathname === '/signup' ? (
                  <>
                    <span className="text-sm text-muted-foreground">Already have an account?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/signin')}
                      className="h-10 rounded-full px-4 text-primary hover:text-primary/80"
                    >
                      Sign in
                    </Button>
                  </>
                ) : pathname === '/signin' ? (
                  <>
                    <span className="text-sm text-muted-foreground">No account?</span>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-10 rounded-full px-4"
                      onClick={() => router.push('/signup')}
                    >
                      Get started
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/signin')}
                      className="h-10 rounded-full px-4 text-muted-foreground hover:text-foreground"
                    >
                      Sign in
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-10 rounded-full px-4"
                      onClick={() => router.push('/signup')}
                    >
                      Get started
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-foreground/70 transition-colors hover:bg-white/5"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#141720]">
          <div className="space-y-1 px-4 py-3">
            {loading ? (
              <p className="text-sm text-muted-foreground py-2">Loading...</p>
            ) : user ? (
              <>
                <button
                  onClick={() => { setMenuOpen(false); router.push('/profile'); }}
                  className="mb-1 flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-white/5"
                >
                  <UserAvatar user={user} size={32} />
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.name ?? user.email}
                    </p>
                    {user.name && user.email && (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                </button>

                <div className="h-px bg-white/[0.06] my-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-full justify-start rounded-2xl px-4 text-foreground/70 hover:text-foreground"
                  onClick={() => { setMenuOpen(false); router.push('/random'); }}
                >
                  <Shuffle className="w-4 h-4 mr-2.5" />
                  Random Chat
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-full justify-start rounded-2xl px-4 text-foreground/70 hover:text-foreground relative"
                  onClick={() => { setMenuOpen(false); router.push('/random'); }}
                >
                  <Bell className="w-4 h-4 mr-2.5" />
                  Friend Requests
                  {friendReqCount > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                      {friendReqCount}
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-full justify-start rounded-2xl px-4 text-foreground/70 hover:text-foreground"
                  onClick={() => { setMenuOpen(false); router.push('/profile'); }}
                >
                  <Settings className="w-4 h-4 mr-2.5" />
                  Profile
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-full justify-start rounded-2xl px-4 text-foreground/70 hover:text-foreground"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2.5" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-full justify-start rounded-2xl px-4 text-foreground/70"
                  onClick={() => { setMenuOpen(false); router.push('/signin'); }}
                >
                  Sign in
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="mt-1 h-11 w-full rounded-2xl"
                  onClick={() => { setMenuOpen(false); router.push('/signup'); }}
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
