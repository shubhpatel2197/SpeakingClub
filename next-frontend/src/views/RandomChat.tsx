'use client'

import { useEffect, useRef, useState } from "react";
import { useRandomChat } from "../hooks/useRandomChat";
import { useAuthContext } from "../context/AuthProvider";
import axiosInstance from "../api/axiosInstance";
import AgreeModal from "../components/randomChat/AgreeModal";
import ChatSidebar from "../components/randomChat/ChatSidebar";
import ChatHome from "../components/randomChat/ChatHome";
import SearchingOverlay from "../components/randomChat/SearchingOverlay";
import RandomChatRoom from "../components/randomChat/RandomChatRoom";
import { UserPlus, Check } from "lucide-react";
import MemberAvatar from "../components/ui/MemberAvatar";
import { useFriendRequests } from "../hooks/useFriendRequests";

export default function RandomChat() {
  const { user, refreshUser } = useAuthContext();
  const rc = useRandomChat();
  const friendReqs = useFriendRequests();

  // Only show agree modal if user has neither gender nor agreedToTerms
  const needsAgreement = user ? (!user.gender || !user.agreedToTerms) : false;
  const [showAgree, setShowAgree] = useState(false);

  const [endedChat, setEndedChat] = useState<{
    partnerName: string;
    partnerId: string | null;
    messages: { id: string; from: string; text: string; ts: number }[];
    reason: "skipped" | "partner-left";
  } | null>(null);

  const [partnerLeftCountdown, setPartnerLeftCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [matchVersion, setMatchVersion] = useState(0);

  // Show agree modal only if user needs to agree
  useEffect(() => {
    if (user && needsAgreement) {
      setShowAgree(true);
    }
  }, [user, needsAgreement]);

  // Handle partner-left countdown
  useEffect(() => {
    if (rc.state === "partner-left") {
      setEndedChat({
        partnerName: rc.partnerName || "Stranger",
        partnerId: rc.partnerId || null,
        messages: [...rc.messages],
        reason: "partner-left",
      });
      setMatchVersion((v) => v + 1);
      setPartnerLeftCountdown(3);
      countdownRef.current = setInterval(() => {
        setPartnerLeftCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
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

  const handleSkip = () => {
    setEndedChat({
      partnerName: rc.partnerName || "Stranger",
      partnerId: rc.partnerId || null,
      messages: [...rc.messages],
      reason: "skipped",
    });
    setMatchVersion((v) => v + 1);
    rc.next();
  };

  const handleNewChat = () => {
    if (rc.state === "matched") {
      handleSkip();
    } else {
      handleStart();
    }
  };

  // ─── Render main content ───
  const renderContent = () => {
    if (rc.state === "searching") {
      return (
        <div className="flex flex-col h-full bg-[#1A1D24]">
          <div className="w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
            <span className="text-foreground font-semibold text-sm">New Chat</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {endedChat && (
              <EndedChatSection
                partnerName={endedChat.partnerName}
                partnerId={endedChat.partnerId}
                messages={endedChat.messages}
                reason={endedChat.reason}
                selfId={user?.id}
              />
            )}
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
          onLeave={rc.leave}
          messages={rc.messages}
          sendChat={rc.sendChat}
          setTyping={rc.setTyping}
          participants={rc.participants}
          selfId={user?.id}
        />
      );
    }

    if (rc.state === "partner-left") {
      return (
        <div className="flex flex-col h-full bg-[#1A1D24]">
          <div className="w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
            <span className="text-foreground font-semibold text-sm">
              @{endedChat?.partnerName || "Stranger"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {endedChat && (
              <EndedChatSection
                partnerName={endedChat.partnerName}
                partnerId={endedChat.partnerId}
                messages={endedChat.messages}
                reason={endedChat.reason}
                selfId={user?.id}
              />
            )}
          </div>
          <div className="px-3 sm:px-4 py-2.5 border-t border-border bg-[#1D2128]">
            <div className="flex items-center gap-2">
              <button
                onClick={rc.leave}
                className="shrink-0 h-[44px] px-3 rounded-lg bg-[#1A1D24] border border-border text-muted-foreground text-xs font-bold uppercase tracking-wider hover:text-foreground hover:border-[#7F9486]/50 transition-all active:scale-95"
              >
                ESC
              </button>
              <div className="flex-1 flex items-center justify-center gap-2 h-[44px] rounded-lg bg-[#1A1D24] border border-border text-muted-foreground text-sm">
                Finding someone new in{" "}
                <span className="text-[#7F9486] font-bold">{partnerLeftCountdown}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Idle with ended chat — show history + ESC/START
    if (endedChat) {
      return (
        <div className="flex flex-col h-full bg-[#1A1D24]">
          <div className="w-full flex items-center px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
            <span className="text-foreground font-semibold text-sm">
              @{endedChat.partnerName}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <EndedChatSection
              partnerName={endedChat.partnerName}
              partnerId={endedChat.partnerId}
              messages={endedChat.messages}
              reason={endedChat.reason}
              selfId={user?.id}
            />
          </div>
          <div className="px-3 sm:px-4 py-2.5 border-t border-border bg-[#1D2128]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEndedChat(null);
                  rc.leave();
                }}
                className="shrink-0 h-[44px] px-3 rounded-lg bg-[#1A1D24] border border-border text-muted-foreground text-xs font-bold uppercase tracking-wider hover:text-foreground hover:border-[#7F9486]/50 transition-all active:scale-95"
              >
                ESC
              </button>
              <button
                onClick={handleStart}
                className="flex-1 h-[44px] rounded-lg bg-[#7F9486] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#6d8275] transition-all active:scale-95"
              >
                START
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Fresh idle
    return <ChatHome onStartText={handleStart} />;
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden">
      <AgreeModal open={showAgree} onAgree={handleAgree} />

      <div className="shrink-0 w-[260px] hidden md:block overflow-hidden">
        <ChatSidebar onNewChat={handleNewChat} friendReqs={friendReqs} matchVersion={matchVersion} />
      </div>

      <div className="flex-1 min-w-0 relative">
        {renderContent()}
      </div>
    </div>
  );
}

/* ─── Ended chat section with Add Friend button ─── */
function EndedChatSection({
  partnerName,
  partnerId,
  messages,
  reason,
  selfId,
}: {
  partnerName: string;
  partnerId: string | null;
  messages: { id: string; from: string; text: string; ts: number }[];
  reason: "skipped" | "partner-left";
  selfId?: string;
}) {
  const [friendSent, setFriendSent] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  const sendFriendRequest = async () => {
    if (!partnerId || friendSent || friendLoading) return;
    setFriendLoading(true);
    try {
      await axiosInstance.post("/api/friends/send", { toId: partnerId });
      setFriendSent(true);
    } catch {
      // might already be friends or request already sent
      setFriendSent(true);
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
              <div className="max-w-[75%] sm:max-w-[60%] bg-[#7F9486]/60 text-white/80 px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed break-words whitespace-pre-wrap">
                {m.text}
              </div>
            </div>
          );
        }

        return (
          <div key={m.id} className="flex items-start gap-2.5">
            <div className="shrink-0 w-8 pt-0.5">
              <MemberAvatar
                member={{ id: m.from, name }}
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

      {/* Add friend button */}
      {partnerId && (
        <div className="flex justify-center">
          <button
            onClick={sendFriendRequest}
            disabled={friendSent || friendLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              friendSent
                ? "bg-[#7F9486]/15 text-[#7F9486] border border-[#7F9486]/30 cursor-default"
                : "bg-[#7F9486] text-white hover:bg-[#6d8275]"
            }`}
          >
            {friendSent ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Friend request sent
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
