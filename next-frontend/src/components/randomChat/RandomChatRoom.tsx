'use client'

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, UserPlus, Check } from "lucide-react";
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
}: Props) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [friendSent, setFriendSent] = useState(false);
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

  const displayMessages = useMemo(() => {
    return messages.map((m) => {
      const isSelf = m.from === "me" || m.from === selfId;
      const displayName = isSelf ? "You" : nameMap[m.from] || partnerName || "Stranger";
      return { ...m, isSelf, displayName };
    });
  }, [messages, nameMap, selfId, partnerName]);

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 150;
    if (nearBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
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
      {/* ─── Top Bar — partner name + add friend ─── */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-2 border-b border-border bg-[#1D2128] z-10">
        <span className="text-foreground font-semibold text-sm truncate">
          @{partnerName || "Stranger"}
        </span>
        {partnerId && (
          <button
            onClick={async () => {
              if (friendSent) return;
              try {
                await axiosInstance.post("/api/friends/send", { toId: partnerId });
                setFriendSent(true);
              } catch {
                setFriendSent(true);
              }
            }}
            disabled={friendSent}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
              friendSent
                ? "bg-[#7F9486]/15 text-[#7F9486] border border-[#7F9486]/30 cursor-default"
                : "bg-[#7F9486] text-white hover:bg-[#6d8275]"
            }`}
          >
            {friendSent ? (
              <><Check className="w-3 h-3" /> Sent</>
            ) : (
              <><UserPlus className="w-3 h-3" /> Add Friend</>
            )}
          </button>
        )}
      </div>

      {/* ─── Messages Area ─── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4"
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
                        member={{ id: m.from, name: m.displayName }}
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
        className="px-3 sm:px-4 pt-2 border-t border-border bg-[#1D2128]"
        style={composerBottomStyle}
      >
        <div className="flex items-end gap-2">
          {/* ESC button */}
          <button
            onClick={onLeave}
            className="shrink-0 h-[44px] px-3 rounded-lg bg-[#1A1D24] border border-border text-muted-foreground text-xs font-bold uppercase tracking-wider hover:text-foreground hover:border-[#7F9486]/50 transition-all active:scale-95"
          >
            ESC
          </button>

          {/* SKIP button */}
          <button
            onClick={onNext}
            className="shrink-0 h-[44px] px-3.5 rounded-lg bg-[#7F9486] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#6d8275] transition-all active:scale-95"
          >
            SKIP
          </button>

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
