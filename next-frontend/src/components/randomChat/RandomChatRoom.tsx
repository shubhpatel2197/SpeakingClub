'use client'

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, UserPlus, Check, Heart, UserMinus, X, ArrowLeft, SkipForward } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import MemberAvatar from "../ui/MemberAvatar";

type ChatMessage = { id: string; from: string; text: string; ts: number };

type Props = {
  partnerName: string | null;
  partnerId?: string | null;
  chatDuration: number;
  onNext: () => void;
  onLeave: () => void;
  messages: ChatMessage[];
  sendChat: (text: string) => void;
  setTyping: (on: boolean) => void;
  participants: any[];
  selfId?: string;
  isFriend?: boolean;
  pendingSent?: boolean;
  onFriendAdded?: (id: string) => void;
  onRequestSent?: (id: string) => void;
  onUnfriended?: (id: string) => void;
};

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 120;

const isIOSMobile = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  typeof window !== "undefined" &&
  window.innerWidth < 900;

export default function RandomChatRoom({
  partnerName,
  partnerId,
  chatDuration,
  onNext,
  onLeave,
  messages,
  sendChat,
  setTyping,
  participants,
  selfId,
  isFriend,
  pendingSent,
  onFriendAdded,
  onRequestSent,
  onUnfriended,
}: Props) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [friendSent, setFriendSent] = useState(false);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const [unfriending, setUnfriending] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const alreadySent = friendSent || pendingSent;
  const [kbInset, setKbInset] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of participants) {
      map[p.id || p.userId] = p.name || p.userId || "User";
    }
    return map;
  }, [participants]);

  const avatarMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const p of participants) {
      map[p.id || p.userId] = p.avatar || null;
    }
    return map;
  }, [participants]);

  const displayMessages = useMemo(() => {
    return messages.map((m) => {
      const isSelf = m.from === "me" || m.from === selfId;
      const displayName = isSelf ? "You" : nameMap[m.from] || partnerName || "Stranger";
      return { ...m, isSelf, displayName };
    });
  }, [messages, nameMap, selfId, partnerName]);

  // Keyboard shortcuts: ESC → ask to skip, ESC twice → skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Don't hijack ESC while typing in the composer
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input") return;
      e.preventDefault();
      setSkipConfirm((prev) => {
        if (prev) {
          onNext();
          return false;
        }
        return true;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext]);

  // Auto-dismiss skip confirmation after 4s of inactivity
  useEffect(() => {
    if (!skipConfirm) return;
    const t = setTimeout(() => setSkipConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [skipConfirm]);

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [displayMessages.length]);

  // iOS keyboard inset handling
  useEffect(() => {
    if (!isIOSMobile() || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onVV = () => {
      const overlap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setKbInset(overlap);
    };
    vv.addEventListener("resize", onVV);
    vv.addEventListener("scroll", onVV);
    onVV();
    return () => {
      vv.removeEventListener("resize", onVV);
      vv.removeEventListener("scroll", onVV);
    };
  }, []);

  // Auto-resize textarea
  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const needed = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, el.scrollHeight));
    el.style.height = `${needed}px`;
    el.style.overflowY = needed >= MAX_HEIGHT ? "auto" : "hidden";
  };

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    sendChat(text);
    setInput("");
    const el = taRef.current;
    if (el) {
      el.value = "";
      el.style.height = `${MIN_HEIGHT}px`;
      el.style.overflowY = "hidden";
    }
    if (isTyping) {
      setIsTyping(false);
      setTyping(false);
    }
  }

  function handleChange(v: string) {
    setInput(v);
    if (!isTyping) {
      setIsTyping(true);
      setTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setTyping(false);
      }, 1000);
    }
  }

  const composerBottomStyle = isIOSMobile()
    ? { paddingBottom: `calc(0.5rem + ${kbInset}px + env(safe-area-inset-bottom, 0px))` }
    : { paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))` };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-[#1A1D24]">
      {/* Ambient background — subtle grid + soft top spotlight */}
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
      {/* ─── Top Bar — partner name + add friend ─── */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-foreground font-semibold text-sm truncate">
            @{partnerName || "Stranger"}
          </span>
          {isFriend && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#7F9486]/15 text-[#7F9486] border border-[#7F9486]/30 text-[10px] font-semibold uppercase tracking-wide">
              <Heart className="w-3 h-3 fill-current" /> Friend
            </span>
          )}
        </div>
        {partnerId && isFriend && (
          showUnfriendConfirm ? (
            <div className="inline-flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground mr-1">Unfriend?</span>
              <button
                onClick={async () => {
                  if (unfriending) return;
                  setUnfriending(true);
                  try {
                    await axiosInstance.delete(`/api/friends/by-user/${partnerId}`);
                    onUnfriended?.(partnerId);
                    setShowUnfriendConfirm(false);
                  } catch {
                    // noop
                  } finally {
                    setUnfriending(false);
                  }
                }}
                disabled={unfriending}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all active:scale-95 disabled:opacity-50"
                title="Confirm unfriend"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => !unfriending && setShowUnfriendConfirm(false)}
                disabled={unfriending}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#1A1D24] text-muted-foreground border border-border hover:text-foreground transition-all active:scale-95 disabled:opacity-50"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowUnfriendConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
            >
              <UserMinus className="w-3 h-3" /> Unfriend
            </button>
          )
        )}
        {partnerId && !isFriend && (
          <button
            onClick={async () => {
              if (alreadySent) return;
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
              }
            }}
            disabled={alreadySent}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
              alreadySent
                ? "bg-[#7F9486]/15 text-[#7F9486] border border-[#7F9486]/30 cursor-default"
                : "bg-[#7F9486] text-white hover:bg-[#6d8275]"
            }`}
          >
            {alreadySent ? (
              <><Check className="w-3 h-3" /> Req Sent</>
            ) : (
              <><UserPlus className="w-3 h-3" /> Add Friend</>
            )}
          </button>
        )}
      </div>

      {/* ─── Messages Area ─── */}
      <div
        ref={listRef}
        className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4"
        style={isIOSMobile() ? { marginBottom: `${kbInset}px` } : undefined}
      >
        {/* System message — "You are now chatting with..." */}
        <p className="text-muted-foreground text-sm mb-4">
          You are now chatting with{" "}
          <span className="font-semibold text-[#7F9486]">
            {partnerName || "Stranger"}
          </span>
          . Say hi!
        </p>

        {displayMessages.length > 0 && (
          <div className="space-y-3">
            {displayMessages.map((m, i) => {
              const prevMsg = i > 0 ? displayMessages[i - 1] : null;
              const showAvatar = !m.isSelf && (!prevMsg || prevMsg.isSelf || prevMsg.from !== m.from);

              if (m.isSelf) {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[75%] sm:max-w-[60%] bg-[#7F9486] text-white px-4 py-2.5 rounded-2xl rounded-br-md text-[14px] sm:text-[15px] leading-relaxed break-words whitespace-pre-wrap shadow-sm">
                      {m.text}
                    </div>
                  </div>
                );
              }

              return (
                <div key={m.id} className="flex items-start gap-2.5">
                  <div className="shrink-0 w-8 pt-0.5">
                    {showAvatar ? (
                      <MemberAvatar
                        member={{ id: m.from, name: m.displayName, avatar: avatarMap[m.from] || null }}
                        avatarSize={32}
                        withName={false}
                      />
                    ) : <div className="w-8" />}
                  </div>
                  <div className="min-w-0">
                    {showAvatar && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[#7F9486] font-semibold text-sm">
                          {m.displayName}
                        </span>
                        <span className="text-muted-foreground/50 text-[11px]">
                          {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}
                    <div className="text-foreground/90 text-[14px] sm:text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Bottom Bar — ESC / SKIP + Input ─── */}
      <div
        className="relative z-10 px-3 sm:px-4 pt-2 border-t border-border bg-[#1D2128]"
        style={composerBottomStyle}
      >
        <div className="flex items-end gap-2">
          {/* ESC → home */}
          <button
            onClick={onLeave}
            title="Back to home"
            aria-label="Back to home"
            className="shrink-0 h-[44px] w-[44px] rounded-lg bg-[#1A1D24] border border-border text-muted-foreground hover:text-foreground hover:border-[#7F9486]/50 transition-all active:scale-95 flex items-center justify-center"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>

          {/* SKIP — with inline confirmation */}
          {skipConfirm ? (
            <div className="shrink-0 inline-flex items-center gap-1.5">
              <button
                onClick={() => { setSkipConfirm(false); onNext(); }}
                title="Confirm skip"
                aria-label="Confirm skip"
                className="h-[44px] w-[44px] rounded-lg flex items-center justify-center bg-[#D97A5C]/15 text-[#e08b70] border border-[#D97A5C]/40 hover:bg-[#D97A5C]/25 transition-all active:scale-95"
              >
                <Check className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => setSkipConfirm(false)}
                title="Cancel"
                aria-label="Cancel skip"
                className="h-[44px] w-[44px] rounded-lg flex items-center justify-center bg-[#1A1D24] text-muted-foreground border border-border hover:text-foreground transition-all active:scale-95"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSkipConfirm(true)}
              className="shrink-0 h-[44px] px-4 rounded-lg bg-[#7F9486]/15 text-[#a7bdae] border border-[#7F9486]/40 text-xs font-bold uppercase tracking-wider hover:bg-[#7F9486]/25 hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip
            </button>
          )}

          {/* Text input */}
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Send a message"
            value={input}
            onChange={(e) => {
              handleChange(e.target.value);
              autosize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            autoComplete="off"
            inputMode="text"
            spellCheck={false}
            className="flex-1 min-w-0 bg-[#1A1D24] text-foreground border border-border rounded-lg px-4 py-3 text-[15px] leading-5 font-sans outline-none resize-none placeholder:text-muted-foreground/50 focus:border-[#7F9486]/50 transition-all duration-200"
            style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`shrink-0 w-[44px] h-[44px] rounded-lg flex items-center justify-center transition-all duration-200 ${input.trim()
              ? "bg-[#7F9486] text-white hover:bg-[#6d8275] active:scale-95"
              : "bg-[#1A1D24] text-muted-foreground/30 cursor-not-allowed border border-border"
              }`}
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

    </div>
  );
}
