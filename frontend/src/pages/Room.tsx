import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Mic,
  MicOff,
  LogOut,
  ScreenShare,
  ScreenShareOff,
  MessageCircle,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Avatar, AvatarFallback } from "../components/ui/avatar-ui";
import ChatPanel from "../components/room/ChatPanel";
import { useAuthContext } from "../context/AuthProvider";
import { useMediasoup } from "../hooks/useMediasoup";
import { useNavigate, useParams } from "react-router-dom";
import { useCurrentGroup } from "../context/CurrentGroupContext";
import { useSnackbar } from "../context/SnackbarProvider";
import VideoArea from "../components/room/VideoArea";

const CHAT_WIDTH = 340;

type RoomParticipant = {
  id: string;
  name?: string | null;
  muted?: boolean;
};

function avatarInitials(nameOrId?: string | null) {
  const s = nameOrId ?? "U";
  return s
    .split(" ")
    .map((t) => (t ? t[0] : ""))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const gradientClasses = [
  "from-violet-500 to-fuchsia-500",
  "from-pink-500 to-rose-500",
  "from-blue-500 to-cyan-500",
  "from-orange-500 to-amber-500",
  "from-green-500 to-emerald-500",
  "from-teal-500 to-cyan-500",
  "from-indigo-500 to-purple-500",
  "from-red-500 to-orange-500",
];

function deterministicGradient(name?: string) {
  const k = name ?? String(Math.random());
  let h = 0;
  for (let i = 0; i < k.length; i++) h = k.charCodeAt(i) + ((h << 5) - h);
  return gradientClasses[Math.abs(h) % gradientClasses.length];
}

export default function Room() {
  const { showSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const [isMdUp, setIsMdUp] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMdUp(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { id: roomId } = useParams<{ id: string }>();
  const { user } = useAuthContext();
  const {
    joinRoom,
    leaveRoom,
    toggleMic,
    micOn,
    participants: rtcParticipants,
    messages,
    sendChat,
    setTyping,
    toggleScreenShare,
    isSharingScreen,
    screenSharerId,
    screenSharerName,
  } = useMediasoup();
  const group = useCurrentGroup();

  const [chatOpen, setChatOpen] = useState<boolean>(false);
  useEffect(() => {
    setChatOpen(isMdUp);
  }, [isMdUp]);

  const currentUserId = user?.id;

  const foreignCount = useMemo(() => {
    return messages.reduce((acc, m) => acc + (m.from !== currentUserId ? 1 : 0), 0);
  }, [messages, currentUserId]);

  const [unread, setUnread] = useState(0);
  const lastSeenForeignRef = useRef(0);

  useEffect(() => {
    if (chatOpen) {
      lastSeenForeignRef.current = foreignCount;
      setUnread(0);
    }
  }, [chatOpen, foreignCount]);

  useEffect(() => {
    if (!chatOpen && foreignCount > lastSeenForeignRef.current) {
      setUnread(foreignCount - lastSeenForeignRef.current);
    }
  }, [chatOpen, foreignCount]);

  const membersCount = useMemo(() => {
    if (!group) return 0;
    if (
      typeof (group as any)._count === "object" &&
      typeof (group as any)._count.memberships === "number"
    ) {
      return (group as any)._count.memberships;
    }
    if (Array.isArray((group as any).memberships))
      return (group as any).memberships.length;
    if (rtcParticipants) return rtcParticipants.length;
    return 0;
  }, [group, rtcParticipants]);

  const [displayMembers, setDisplayMembers] = useState<RoomParticipant[]>([]);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  const isOwner = !!(
    user?.id &&
    (group as any)?.owner &&
    user.id === (group as any).owner.id
  );

  useEffect(() => {
    const map = new Map<string, RoomParticipant>();
    rtcParticipants.forEach((p: any) => {
      const prev = map.get(p.id);
      map.set(p.id, {
        id: p.id,
        name: p.name ?? prev?.name ?? p.id,
        muted: typeof p.muted === "boolean" ? p.muted : prev?.muted,
      });
    });
    if (user?.id && !map.has(user.id)) {
      map.set(user.id, { id: user.id, name: user.name ?? user.email ?? "You" });
    }
    setDisplayMembers(Array.from(map.values()));
  }, [rtcParticipants, user?.id, user?.name, user?.email]);

  useEffect(() => {
    if (!roomId) return;
    joinRoom(roomId);
  }, [roomId]);

  const handleLeaveClick = async () => setConfirmLeaveOpen(true);
  const confirmLeave = async () => {
    leaveRoom();
    setConfirmLeaveOpen(false);
  };
  const cancelLeave = () => setConfirmLeaveOpen(false);

  const nameMapRef = useRef<Record<string, string>>({});
  const nameMap = useMemo(() => {
    const newMap = { ...nameMapRef.current };
    for (const m of displayMembers) newMap[m.id] = m.name || m.id;
    nameMapRef.current = newMap;
    return newMap;
  }, [displayMembers]);

  const sharingBanner =
    screenSharerId && !isSharingScreen
      ? `${screenSharerName || "Someone"} is sharing`
      : isSharingScreen
        ? "You are sharing"
        : "";

  const reservedRight = isMdUp && chatOpen ? `${CHAT_WIDTH}px` : "0px";

  return (
    <div className="flex flex-col h-[91vh] w-full border-2 border-border min-h-0 bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-border glass gap-2">
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-base truncate max-w-[60vw] md:max-w-[40vw]">
            {(group as any)?.description ?? "Group room"}
          </h2>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Language: {(group as any)?.language ?? "—"} • Level:{" "}
            {(group as any)?.level ?? "—"} • Members: {membersCount}
          </p>
          {sharingBanner && (
            <p className="text-xs text-primary font-medium">{sharingBanner}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Chat toggle */}
          <button
            onClick={() => {
              const next = !chatOpen;
              setChatOpen(next);
              if (next) setUnread(0);
            }}
            className="relative p-2 rounded-lg hover:bg-white/10 text-primary transition-colors"
            title={chatOpen ? "Hide chat" : "Show chat"}
          >
            <MessageCircle className="w-5 h-5" />
            {!chatOpen && unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_4px_#22c55e]" />
            )}
          </button>

          {/* Invite */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard
                ?.writeText(window.location.href)
                .then(() => showSnackbar("Copied link to clipboard"))
                .catch(() => showSnackbar("Failed to copy link to clipboard"));
            }}
          >
            <LinkIcon className="w-4 h-4 mr-1" />
            Invite
          </Button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            disabled={
              !isSharingScreen &&
              !!screenSharerId &&
              screenSharerId !== currentUserId
            }
            className={`p-2 rounded-lg transition-colors ${isSharingScreen
                ? "text-destructive hover:bg-destructive/10"
                : "text-primary hover:bg-white/10"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={
              isSharingScreen
                ? "Stop screen share"
                : screenSharerId && screenSharerId !== currentUserId
                  ? `${screenSharerName || "Someone"} is already sharing`
                  : "Start screen share"
            }
          >
            {isSharingScreen ? (
              <ScreenShareOff className="w-5 h-5" />
            ) : (
              <ScreenShare className="w-5 h-5" />
            )}
          </button>

          {/* Leave */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveClick}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 mr-1" />
            Leave
          </Button>
        </div>
      </div>

      {/* Middle: Video + Chat */}
      <div className="relative flex flex-col flex-1 min-h-0">
        {/* Video */}
        <div className="flex-1 flex relative w-full min-h-0">
          <VideoArea
            isSharingScreen={isSharingScreen}
            screenSharerId={screenSharerId}
            screenSharerName={screenSharerName}
            chatWidth={isMdUp && chatOpen ? CHAT_WIDTH : 0}
          />
        </div>

        {/* Bottom Bar: Members */}
        <div
          className="flex items-center gap-2.5 p-2 border-t-2 border-border glass"
          style={{ paddingRight: reservedRight }}
        >
          {/* Quick screen share */}
          <div className="flex items-center gap-1.5 mr-2">
            <button
              onClick={toggleScreenShare}
              disabled={
                !isSharingScreen &&
                !!screenSharerId &&
                screenSharerId !== currentUserId
              }
              className={`p-1.5 rounded-lg transition-colors ${isSharingScreen
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-primary hover:bg-white/10"
                } disabled:opacity-40`}
              title={isSharingScreen ? "Stop sharing" : "Share screen"}
            >
              {isSharingScreen ? (
                <ScreenShareOff className="w-4 h-4" />
              ) : (
                <ScreenShare className="w-4 h-4" />
              )}
            </button>

            <div className="w-px h-6 bg-border hidden sm:block" />
          </div>

          {/* Members scroll */}
          <div className="flex gap-2 overflow-x-auto items-center flex-1 px-1">
            {displayMembers.map((p) => {
              const isCurrent = p.id === currentUserId;
              const displayName = p.name ?? p.id;
              const showMicOn = isCurrent
                ? micOn
                : p.muted === undefined
                  ? true
                  : !p.muted;
              const gradient = deterministicGradient(displayName);

              return (
                <div key={p.id} className="flex flex-col items-center min-w-[72px] gap-1 py-1">
                  <Avatar
                    className="ring-2 ring-primary/20"
                    style={{ width: 48, height: 48 }}
                  >
                    <AvatarFallback
                      className={`bg-gradient-to-br text-white font-semibold text-xs ${gradient}`}
                    >
                      {avatarInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="text-[11px] text-center max-w-[70px] truncate"
                    title={displayName}
                  >
                    {displayName}
                  </span>
                  <button
                    onClick={() => {
                      if (!isCurrent) return;
                      toggleMic();
                    }}
                    className={`p-1 rounded-full transition-colors ${showMicOn
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground"
                      } ${isCurrent ? "cursor-pointer hover:bg-primary/25" : "cursor-default"}`}
                    title={
                      isCurrent
                        ? showMicOn
                          ? "Mute"
                          : "Unmute"
                        : showMicOn
                          ? "Mic on"
                          : "Mic off"
                    }
                  >
                    {showMicOn ? (
                      <Mic className="w-3.5 h-3.5" />
                    ) : (
                      <MicOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Panel */}
        {chatOpen && (
          <ChatPanel
            onClose={() => setChatOpen(false)}
            messages={messages}
            onSend={(t) => {
              sendChat(t);
              setUnread(0);
              lastSeenForeignRef.current = foreignCount;
            }}
            onTyping={setTyping}
            nameMap={nameMap}
            selfId={currentUserId}
            panelWidth={CHAT_WIDTH}
            mobileFullScreen
          />
        )}
      </div>

      {/* Leave confirmation */}
      <Dialog open={confirmLeaveOpen} onOpenChange={(open) => setConfirmLeaveOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave room?</DialogTitle>
            <DialogDescription>
              {isOwner
                ? "You're the owner. Leaving may close the session for everyone."
                : "You can rejoin anytime using the invite link."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelLeave}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLeave}
            >
              <LogOut className="w-4 h-4 mr-1" />
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
