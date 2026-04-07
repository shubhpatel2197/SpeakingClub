'use client'

import { useEffect, useState } from "react";
import { useRandomChat } from "../hooks/useRandomChat";
import { useAuthContext } from "../context/AuthProvider";
import axiosInstance from "../api/axiosInstance";
import AgreeModal from "../components/randomChat/AgreeModal";
import ChatSidebar from "../components/randomChat/ChatSidebar";
import ChatHome from "../components/randomChat/ChatHome";
import SearchingOverlay from "../components/randomChat/SearchingOverlay";
import RandomChatRoom from "../components/randomChat/RandomChatRoom";
import { UserPlus, Check, Play, ArrowLeft, X, PanelLeft } from "lucide-react";
import MemberAvatar from "../components/ui/MemberAvatar";
import { useFriendRequests } from "../hooks/useFriendRequests";
import { useMediaQuery } from "../hooks/use-media-query";

export default function RandomChat() {
  const { user, refreshUser } = useAuthContext();
  const rc = useRandomChat();

  // Sync URL with room state — /random/:roomId when matched, /random otherwise
  useEffect(() => {
    if (rc.state === "matched" && rc.roomId) {
      // Strip any "randomChat:" / "randomchat-" prefix and shorten to 8 chars
      const shortId = rc.roomId
        .replace(/^randomchat[:\-_]?/i, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 8);
      const target = `/random/${shortId}`;
      if (typeof window !== "undefined" && window.location.pathname !== target) {
        window.history.replaceState(null, "", target);
      }
    } else {
      if (typeof window !== "undefined" && window.location.pathname !== "/random") {
        window.history.replaceState(null, "", "/random");
      }
    }
  }, [rc.state, rc.roomId]);
  const friendReqs = useFriendRequests();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingSentIds, setPendingSentIds] = useState<Set<string>>(new Set());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const refreshFriendIds = () => {
    axiosInstance.get("/api/friends").then(({ data }) => {
      setFriendIds(new Set((data.friends || []).map((f: any) => f.friendId)));
    }).catch(() => {});
  };

  useEffect(() => {
    refreshFriendIds();
    axiosInstance.get("/api/friends/sent").then(({ data }) => {
      setPendingSentIds(new Set(data.sent || []));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (friendReqs.acceptedVersion > 0) {
      refreshFriendIds();
    }
  }, [friendReqs.acceptedVersion]);

  useEffect(() => {
    if (isDesktop) {
      setMobileSidebarOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [rc.state]);

  // Only show agree modal if user has neither gender nor agreedToTerms
  const needsAgreement = user ? (!user.gender || !user.agreedToTerms) : false;
  const [showAgree, setShowAgree] = useState(false);

  const [endedChat, setEndedChat] = useState<{
    partnerName: string;
    partnerId: string | null;
    partnerAvatar: string | null;
    messages: { id: string; from: string; text: string; ts: number }[];
    reason: "skipped" | "partner-left";
  } | null>(null);

  const getPartnerAvatar = (): string | null => {
    if (!rc.partnerId) return null;
    const p = rc.participants.find((x: any) => (x.id || x.userId) === rc.partnerId);
    return p?.avatar || null;
  };

  const [matchVersion, setMatchVersion] = useState(0);
  const [friendsVersion, setFriendsVersion] = useState(0);

  // Show agree modal only if user needs to agree
  useEffect(() => {
    if (user && needsAgreement) {
      setShowAgree(true);
    }
  }, [user, needsAgreement]);

  // Capture ended chat on partner-left
  useEffect(() => {
    if (rc.state === "partner-left") {
      setEndedChat({
        partnerName: rc.partnerName || "Stranger",
        partnerId: rc.partnerId || null,
        partnerAvatar: rc.lastPartnerAvatar ?? getPartnerAvatar(),
        messages: rc.lastMessages.length ? [...rc.lastMessages] : [...rc.messages],
        reason: "partner-left",
      });
      setMatchVersion((v) => v + 1);
    }
  }, [rc.state]);

  const handleAgree = async (gender: "MALE" | "FEMALE") => {
    try {
      await axiosInstance.patch("/api/profile", { gender, agreedToTerms: true });
      await refreshUser();
    } catch {}
    setShowAgree(false);
  };

  const handleStart = () => {
    setEndedChat(null);
    rc.startSearching();
  };

  // ESC → main Random Chat screen (ChatHome)
  const handleGoHome = () => {
    setEndedChat(null);
    rc.leave();
  };

  // Global ESC handling for searching & ended-chat states
  // (matched-state ESC is handled inside RandomChatRoom)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input") return;
      if (rc.state === "searching") {
        e.preventDefault();
        rc.cancelSearch();
      } else if (rc.state === "partner-left" || (rc.state === "idle" && endedChat)) {
        e.preventDefault();
        handleGoHome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rc.state, endedChat]);

  const handleSkip = () => {
    setEndedChat({
      partnerName: rc.partnerName || "Stranger",
      partnerId: rc.partnerId || null,
      partnerAvatar: getPartnerAvatar(),
      messages: [...rc.messages],
      reason: "skipped",
    });
    setMatchVersion((v) => v + 1);
    rc.next();
  };

  const handleNewChat = () => {
    setMobileSidebarOpen(false);
    if (rc.state === "matched") {
      handleSkip();
    } else {
      handleStart();
    }
  };

  // ─── Render main content ───
  const renderContent = () => {
    if (rc.state === "searching") {
      // If there's an ended chat (user skipped), show transcript + compact searching bar at bottom
      if (endedChat) {
        return (
          <div className="relative flex flex-col h-full bg-[#1A1D24] overflow-hidden">
            <EndedBackground />
            <div className="relative z-10 w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
              <span className="text-foreground font-semibold text-sm">
                @{endedChat.partnerName}
              </span>
            </div>
            <div className="relative z-10 flex-1 overflow-y-auto">
              <EndedChatSection
                partnerName={endedChat.partnerName}
                partnerId={endedChat.partnerId}
                partnerAvatar={endedChat.partnerAvatar}
                messages={endedChat.messages}
                reason={endedChat.reason}
                selfId={user?.id}
                isFriend={endedChat.partnerId ? friendIds.has(endedChat.partnerId) : false}
                pendingSent={endedChat.partnerId ? pendingSentIds.has(endedChat.partnerId) : false}
                onFriendAdded={(id) => { setFriendIds((prev) => new Set(prev).add(id)); }}
                onRequestSent={(id) => { setPendingSentIds((prev) => new Set(prev).add(id)); }}
              />
            </div>
            <CompactSearchingBar searchTime={rc.searchTime} onCancel={rc.cancelSearch} />
          </div>
        );
      }

      // Fresh search — full-screen overlay
      return (
        <div className="flex flex-col h-full bg-[#1A1D24]">
          <div className="w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
            <span className="text-foreground font-semibold text-sm">New Chat</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SearchingOverlay searchTime={rc.searchTime} onCancel={rc.cancelSearch} />
          </div>
        </div>
      );
    }

    if (rc.state === "matched") {
      return (
        <RandomChatRoom
          partnerName={rc.partnerName}
          partnerId={rc.partnerId}
          chatDuration={rc.chatDuration}
          onNext={handleSkip}
          onLeave={handleGoHome}
          messages={rc.messages}
          sendChat={rc.sendChat}
          setTyping={rc.setTyping}
          participants={rc.participants}
          selfId={user?.id}
          isFriend={rc.partnerId ? friendIds.has(rc.partnerId) : false}
          pendingSent={rc.partnerId ? pendingSentIds.has(rc.partnerId) : false}
          onFriendAdded={(id) => { setFriendIds((prev) => new Set(prev).add(id)); }}
          onRequestSent={(id) => { setPendingSentIds((prev) => new Set(prev).add(id)); }}
          onUnfriended={(id) => {
            setFriendIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            setFriendsVersion((v) => v + 1);
          }}
        />
      );
    }

    if (rc.state === "partner-left") {
      return (
        <div className="relative flex flex-col h-full bg-[#1A1D24] overflow-hidden">
          <EndedBackground />
          <div className="relative z-10 w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
            <span className="text-foreground font-semibold text-sm">
              @{endedChat?.partnerName || "Stranger"}
            </span>
          </div>
          <div className="relative z-10 flex-1 overflow-y-auto">
            {endedChat && (
              <EndedChatSection
                partnerName={endedChat.partnerName}
                partnerId={endedChat.partnerId}
                partnerAvatar={endedChat.partnerAvatar}
                messages={endedChat.messages}
                reason={endedChat.reason}
                selfId={user?.id}
                isFriend={endedChat.partnerId ? friendIds.has(endedChat.partnerId) : false}
                pendingSent={endedChat.partnerId ? pendingSentIds.has(endedChat.partnerId) : false}
                onFriendAdded={(id) => { setFriendIds((prev) => new Set(prev).add(id)); }}
                onRequestSent={(id) => { setPendingSentIds((prev) => new Set(prev).add(id)); }}
              />
            )}
          </div>
          <EndedBottomBar onStart={handleStart} onHome={handleGoHome} />
        </div>
      );
    }

    // Idle with ended chat — show history + centered START
    if (endedChat) {
      return (
        <div className="relative flex flex-col h-full bg-[#1A1D24] overflow-hidden">
          <EndedBackground />
          <div className="relative z-10 w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
            <span className="text-foreground font-semibold text-sm">
              @{endedChat.partnerName}
            </span>
          </div>
          <div className="relative z-10 flex-1 overflow-y-auto">
            <EndedChatSection
              partnerName={endedChat.partnerName}
              partnerId={endedChat.partnerId}
              partnerAvatar={endedChat.partnerAvatar}
              messages={endedChat.messages}
              reason={endedChat.reason}
              selfId={user?.id}
              isFriend={endedChat.partnerId ? friendIds.has(endedChat.partnerId) : false}
              pendingSent={endedChat.partnerId ? pendingSentIds.has(endedChat.partnerId) : false}
              onFriendAdded={(id) => { setFriendIds((prev) => new Set(prev).add(id)); }}
              onRequestSent={(id) => { setPendingSentIds((prev) => new Set(prev).add(id)); }}
            />
          </div>
          <EndedBottomBar onStart={handleStart} onHome={handleGoHome} />
        </div>
      );
    }

    // Fresh idle
    return <ChatHome onStartText={handleStart} />;
  };

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] overflow-hidden bg-[#1A1D24]">
      <AgreeModal open={showAgree} onAgree={handleAgree} />

      <div className="shrink-0 hidden w-[260px] overflow-hidden md:block">
        <ChatSidebar
          onNewChat={handleNewChat}
          friendReqs={friendReqs}
          matchVersion={matchVersion}
          friendsVersion={friendsVersion}
          onFriendAccepted={refreshFriendIds}
        />
      </div>

      <div className="flex-1 min-w-0 relative">
        {renderContent()}
      </div>

      {!isDesktop && (
        <>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className={`absolute right-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1D2128]/95 px-4 py-3 text-sm font-semibold text-foreground shadow-xl shadow-black/30 backdrop-blur transition-all active:scale-95 ${
              rc.state === "matched" ? "top-4" : "bottom-4"
            }`}
            style={{
              top: rc.state === "matched" ? "calc(1rem + env(safe-area-inset-top, 0px))" : undefined,
              bottom:
                rc.state === "matched"
                  ? undefined
                  : "calc(1rem + env(safe-area-inset-bottom, 0px))",
            }}
            aria-label="Open chats drawer"
          >
            <PanelLeft className="h-4 w-4 text-[#7F9486]" />
            Chats
            {friendReqs.count > 0 && (
              <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#7F9486] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {friendReqs.count}
              </span>
            )}
          </button>

          {mobileSidebarOpen && (
            <div className="absolute inset-0 z-40 md:hidden">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute inset-0 bg-black/55"
                aria-label="Close chats drawer backdrop"
              />
              <div
                className="absolute inset-x-0 bottom-0 top-14 overflow-hidden rounded-t-[28px] border border-white/10 bg-[#1A1D24] shadow-2xl shadow-black/40"
                style={{
                  paddingBottom: "env(safe-area-inset-bottom, 0px)",
                }}
              >
                <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-white/10" />
                <ChatSidebar
                  onNewChat={handleNewChat}
                  friendReqs={friendReqs}
                  matchVersion={matchVersion}
                  friendsVersion={friendsVersion}
                  onFriendAccepted={refreshFriendIds}
                  mobile
                  onClose={() => setMobileSidebarOpen(false)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Shared ambient background for ended-chat views ─── */
function EndedBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `
          radial-gradient(ellipse 65% 40% at 50% 0%, rgba(217,122,92,0.12), transparent 70%),
          linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 44px 44px, 44px 44px",
      }}
    />
  );
}

/* ─── Compact searching bar (shown below a just-ended chat transcript) ─── */
function CompactSearchingBar({ searchTime, onCancel }: { searchTime: number; onCancel: () => void }) {
  const m = Math.floor(searchTime / 60);
  const s = searchTime % 60;
  const time = `${m}:${s.toString().padStart(2, "0")}`;
  return (
    <div
      className="relative z-10 px-3 sm:px-4 pt-2.5 border-t border-border bg-[#1D2128]"
      style={{ paddingBottom: `calc(0.625rem + env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="flex items-center gap-2">
        {/* Live indicator + label */}
        <div className="flex-1 h-[44px] rounded-lg bg-[#1A1D24] border border-border flex items-center gap-3 px-4 overflow-hidden">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D97A5C] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D97A5C]" />
          </span>
          <span className="text-sm text-foreground font-medium truncate">
            Looking for someone new
          </span>
          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
            {time}
          </span>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          title="Cancel search"
          aria-label="Cancel search"
          className="shrink-0 h-[44px] w-[44px] rounded-lg bg-[#1A1D24] border border-border text-muted-foreground hover:text-foreground hover:border-[#D97A5C]/50 transition-all active:scale-95 flex items-center justify-center"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  );
}

/* ─── Bottom bar shown after a chat ends ─── */
function EndedBottomBar({ onStart, onHome }: { onStart: () => void; onHome: () => void }) {
  return (
    <div
      className="relative z-10 px-3 sm:px-4 pt-2.5 border-t border-border bg-[#1D2128]"
      style={{ paddingBottom: `calc(0.625rem + env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onHome}
          title="Back to home"
          aria-label="Back to home"
          className="shrink-0 h-[44px] w-[44px] rounded-lg bg-[#1A1D24] border border-border text-muted-foreground hover:text-foreground hover:border-[#7F9486]/50 transition-all active:scale-95 flex items-center justify-center"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onStart}
          className="flex-1 h-[44px] rounded-lg bg-[#7F9486] text-white text-sm font-semibold hover:bg-[#6d8275] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-current" />
          Start New Chat
        </button>
      </div>
    </div>
  );
}

/* ─── Ended chat section with Add Friend button ─── */
function EndedChatSection({
  partnerName,
  partnerId,
  partnerAvatar,
  messages,
  reason,
  selfId,
  isFriend,
  pendingSent,
  onFriendAdded,
  onRequestSent,
}: {
  partnerName: string;
  partnerId: string | null;
  partnerAvatar: string | null;
  messages: { id: string; from: string; text: string; ts: number }[];
  reason: "skipped" | "partner-left";
  selfId?: string;
  isFriend?: boolean;
  pendingSent?: boolean;
  onFriendAdded?: (id: string) => void;
  onRequestSent?: (id: string) => void;
}) {
  const [friendSent, setFriendSent] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  const alreadySent = friendSent || pendingSent;

  const sendFriendRequest = async () => {
    if (!partnerId || alreadySent || friendLoading) return;
    setFriendLoading(true);
    try {
      const { data } = await axiosInstance.post("/api/friends/send", { toId: partnerId });
      if (data.autoAccepted) {
        onFriendAdded?.(partnerId);
      } else {
        setFriendSent(true);
        onRequestSent?.(partnerId);
      }
    } catch {
      setFriendSent(true);
      onRequestSent?.(partnerId);
    } finally {
      setFriendLoading(false);
    }
  };

  return (
    <div className="space-y-3 px-4 sm:px-6 py-4">
      {/* System header */}
      <p className="text-muted-foreground text-sm">
        You were chatting with{" "}
        <span className="font-semibold text-[#7F9486]">{partnerName}</span>
      </p>

      {/* Messages */}
      {messages.map((m) => {
        const isSelf = m.from === "me" || m.from === selfId;
        const name = isSelf ? "You" : partnerName;

        if (isSelf) {
          return (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[75%] sm:max-w-[60%] bg-[#7F9486]/60 text-white/80 px-4 py-2.5 rounded-2xl rounded-br-md text-[14px] sm:text-[15px] leading-relaxed break-words whitespace-pre-wrap shadow-sm">
                {m.text}
              </div>
            </div>
          );
        }

        return (
          <div key={m.id} className="flex items-start gap-2.5">
            <div className="shrink-0 w-8 pt-0.5">
              <MemberAvatar
                member={{ id: partnerId || m.from, name, avatar: partnerAvatar }}
                avatarSize={32}
                withName={false}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[#7F9486]/70 font-semibold text-sm">{name}</span>
                <span className="text-muted-foreground/40 text-[11px]">
                  {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="text-foreground/60 text-sm leading-relaxed break-words whitespace-pre-wrap">
                {m.text}
              </div>
            </div>
          </div>
        );
      })}

      {/* Ended notice + Add Friend */}
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs font-medium text-muted-foreground/60 shrink-0">
          {reason === "skipped" ? "You skipped this chat" : "Partner left the chat"}
        </span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Add friend button — hidden if already friends */}
      {partnerId && !isFriend && (
        <div className="flex justify-center">
          <button
            onClick={sendFriendRequest}
            disabled={alreadySent || friendLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              alreadySent
                ? "bg-[#7F9486]/15 text-[#7F9486] border border-[#7F9486]/30 cursor-default"
                : "bg-[#7F9486] text-white hover:bg-[#6d8275]"
            }`}
          >
            {alreadySent ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Req Sent
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                Add {partnerName} as friend
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
