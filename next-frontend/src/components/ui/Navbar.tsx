'use client'

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '../../context/AuthProvider';
import { Button } from './button';
import { Menu, X, Shuffle, LogOut, Settings, Bell, Phone } from 'lucide-react';
import { useFriendRequests } from '../../hooks/useFriendRequests';
import NotificationPopup from './NotificationPopup';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../../lib/authToken';
import { useSnackbar } from '../../context/SnackbarProvider';

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
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const pathname = usePathname();
  const { count: friendReqCount } = useFriendRequests();

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [incomingFriendChat, setIncomingFriendChat] = React.useState<{
    roomId: string;
    fromId: string;
    fromName: string;
  } | null>(null);
  const [answeringFriendChat, setAnsweringFriendChat] = React.useState(false);
  const bellRef = React.useRef<HTMLButtonElement>(null);
  const friendChatSocketRef = React.useRef<Socket | null>(null);

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    try {
      setMenuOpen(false);
      await signOut();
    } finally {
      setSigningOut(false);
      setConfirmSignOutOpen(false);
    }
  };

  React.useEffect(() => {
    if (!user) {
      try {
        friendChatSocketRef.current?.disconnect();
      } catch {}
      friendChatSocketRef.current = null;
      setIncomingFriendChat(null);
      return;
    }

    const socket = io(process.env.NEXT_PUBLIC_API_BASE_URL || '/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        token: getAuthToken(),
      },
      reconnection: true,
    });

    friendChatSocketRef.current = socket;

    socket.on('friendChat:incoming', (payload: { roomId: string; fromId: string; fromName: string }) => {
      setIncomingFriendChat(payload);
      setAnsweringFriendChat(false);
    });

    socket.on('friendChat:ready', ({ roomId }: { roomId: string }) => {
      setIncomingFriendChat(null);
      setAnsweringFriendChat(false);
      router.push(`/room/${encodeURIComponent(roomId)}`);
    });

    socket.on('friendChat:calling', () => {});

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (friendChatSocketRef.current === socket) {
        friendChatSocketRef.current = null;
      }
    };
  }, [user, router, showSnackbar]);

  const acceptIncomingFriendChat = () => {
    if (!incomingFriendChat || !friendChatSocketRef.current || answeringFriendChat) return;

    setAnsweringFriendChat(true);
    friendChatSocketRef.current.emit('friendChat:accept', { roomId: incomingFriendChat.roomId }, (res: any) => {
      if (res?.ok) return;
      setAnsweringFriendChat(false);
      showSnackbar('Could not join the private chat.', { severity: 'error' });
    });
  };

  const declineIncomingFriendChat = React.useCallback(() => {
    if (!incomingFriendChat || !friendChatSocketRef.current || answeringFriendChat) return;

    friendChatSocketRef.current.emit('friendChat:decline', { roomId: incomingFriendChat.roomId }, () => {
      setIncomingFriendChat(null);
      setAnsweringFriendChat(false);
    });
  }, [answeringFriendChat, incomingFriendChat]);

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

                <div className="relative">
                  <button
                    ref={bellRef}
                    onClick={() => setNotifOpen((v) => !v)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <Bell className="w-4 h-4" />
                    {friendReqCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
                        {friendReqCount}
                      </span>
                    )}
                  </button>
                  <NotificationPopup open={notifOpen} onClose={() => setNotifOpen(false)} triggerRef={bellRef} />
                </div>

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

                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmSignOutOpen(true)}
                        className="ml-1 h-10 w-10 rounded-full p-0 text-muted-foreground hover:text-foreground"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sign out</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                  onClick={() => { setMenuOpen(false); setNotifOpen(true); }}
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
                  onClick={() => setConfirmSignOutOpen(true)}
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

      <Dialog open={confirmSignOutOpen} onOpenChange={(open) => !signingOut && setConfirmSignOutOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You&apos;ll need to sign in again to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmSignOutOpen(false)}
              disabled={signingOut}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!incomingFriendChat} onOpenChange={(open) => !answeringFriendChat && !open && declineIncomingFriendChat()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Incoming chat
            </DialogTitle>
            <DialogDescription>
              {incomingFriendChat?.fromName || 'A friend'} wants to start a private chat with you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={declineIncomingFriendChat}
              disabled={answeringFriendChat}
            >
              Decline
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={acceptIncomingFriendChat}
              disabled={answeringFriendChat}
            >
              {answeringFriendChat ? 'Joining...' : 'Accept'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
