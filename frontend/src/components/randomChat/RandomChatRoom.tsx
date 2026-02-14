import { useEffect, useMemo, useRef, useState } from "react";
import { SkipForward, LogOut, Send, Circle, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import MemberAvatar from "../ui/MemberAvatar";

const ANIMATIONS = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes countdown {
  0% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}
@keyframes msgSlideIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes onlinePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.6); }
  50% { box-shadow: 0 0 0 4px rgba(52,211,153,0); }
}
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes float {
  0% { transform: translateY(0px) scale(1); opacity: 0.4; }
  100% { transform: translateY(-100vh) scale(0.2); opacity: 0; }
}
@keyframes pulseRing {
  0% { transform: scale(0.4); opacity: 0.8; }
  100% { transform: scale(2.8); opacity: 0; }
}
@keyframes emptyBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
`;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type ChatMessage = { id: string; from: string; text: string; ts: number };

type Props = {
  partnerName: string | null;
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
    ? { paddingBottom: `calc(0.75rem + ${kbInset}px + env(safe-area-inset-bottom, 0px))` }
    : { paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` };

  return (
    <div
      className="flex flex-col h-[calc(100dvh-4rem)] w-full relative overflow-hidden"
      style={{
        background: "linear-gradient(165deg, #0a0a18 0%, #0f0c29 40%, #1a1040 100%)",
        animation: "fadeIn 0.35s ease-out",
      }}
    >
      <style>{ANIMATIONS}</style>

      {/* ─── Top Bar ─── */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-xl z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <MemberAvatar
              member={{ id: partnerName || "S", name: partnerName || "Stranger" }}
              avatarSize={36}
              withName={false}
            />
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0f0c29]"
              style={{ animation: "onlinePulse 2s ease-in-out infinite" }}
            />
          </div>
          <div className="min-w-0">
            <h6 className="text-white font-semibold text-[15px] leading-tight truncate max-w-[40vw]">
              {partnerName || "Stranger"}
            </h6>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400/70 text-[11px] font-medium">Online</span>
              <span className="text-white/20 text-[11px]">•</span>
              <span className="text-white/35 text-[11px] tabular-nums font-mono">
                {formatDuration(chatDuration)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            onClick={onNext}
            size="sm"
            className="bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#7b8ef5] hover:to-[#8b5cb8] text-white font-semibold text-xs sm:text-sm rounded-full px-3 sm:px-5 h-8 sm:h-9 shadow-[0_2px_16px_rgba(102,126,234,0.35)] hover:shadow-[0_4px_24px_rgba(102,126,234,0.55)] transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] border-0"
          >
            <SkipForward className="w-3.5 h-3.5 mr-1" />
            Next
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-full px-3 h-8 sm:h-9 text-xs sm:text-sm font-medium transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Leave
          </Button>
        </div>
      </div>

      {/* ─── Messages Area ─── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-5 py-4"
        style={isIOSMobile() ? { marginBottom: `${kbInset}px` } : undefined}
      >
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
            <div
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#667eea]/20 to-[#764ba2]/20 border border-white/[0.08] flex items-center justify-center"
              style={{ animation: "emptyBounce 3s ease-in-out infinite" }}
            >
              <Sparkles className="w-9 h-9 text-[#667eea]/60" />
            </div>
            <div className="text-center">
              <p className="text-white/50 text-sm font-medium mb-1">
                Say hello! 👋
              </p>
              <p className="text-white/30 text-xs max-w-[220px] leading-relaxed">
                Start a conversation with {partnerName || "your new friend"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {displayMessages.map((m, i) => {
              const prevMsg = i > 0 ? displayMessages[i - 1] : null;
              const showAvatar = !m.isSelf && (!prevMsg || prevMsg.isSelf || prevMsg.from !== m.from);
              const showTime = !prevMsg || (m.ts - prevMsg.ts > 60000) || prevMsg.isSelf !== m.isSelf;

              return (
                <div key={m.id}>
                  {showTime && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] text-white/30 bg-white/[0.04] px-3 py-1 rounded-full font-medium tracking-wide uppercase">
                        {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex items-end gap-2 ${m.isSelf ? "justify-end" : "justify-start"}`}
                    style={{ animation: "msgSlideIn 0.2s ease-out" }}
                  >
                    {!m.isSelf && (
                      <div className="shrink-0 w-7 mb-0.5">
                        {showAvatar ? (
                          <MemberAvatar
                            member={{ id: m.from, name: m.displayName }}
                            avatarSize={28}
                            withName={false}
                          />
                        ) : null}
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] sm:max-w-[65%] px-4 py-2.5 text-[14px] sm:text-[15px] leading-relaxed break-words whitespace-pre-wrap ${m.isSelf
                        ? "bg-gradient-to-br from-[#667eea] to-[#5a67d8] text-white rounded-2xl rounded-br-md shadow-[0_2px_12px_rgba(102,126,234,0.25)]"
                        : "bg-white/[0.08] text-white/90 rounded-2xl rounded-bl-md border border-white/[0.06]"
                        }`}
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Composer ─── */}
      <div
        className="px-3 sm:px-5 pt-2.5 border-t border-white/[0.08] bg-[#0d0c1a]/95 backdrop-blur-xl"
        style={composerBottomStyle}
      >
        <div className="flex items-end gap-2.5">
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Type a message..."
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
            className="flex-1 min-w-0 bg-white/[0.08] text-white border border-white/[0.12] rounded-2xl px-4 py-3 text-[16px] leading-5 font-sans outline-none resize-none placeholder:text-white/40 focus:bg-white/[0.12] focus:border-[#667eea]/50 focus:shadow-[0_0_0_2px_rgba(102,126,234,0.15)] transition-all duration-200"
            style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${input.trim()
              ? "bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white shadow-[0_2px_16px_rgba(102,126,234,0.45)] hover:shadow-[0_4px_24px_rgba(102,126,234,0.65)] hover:scale-105 active:scale-95"
              : "bg-white/[0.06] text-white/25 cursor-not-allowed"
              }`}
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Overlay shown when partner disconnects, with auto-countdown ─── */
const OVERLAY_PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  size: 2 + Math.random() * 4,
  delay: Math.random() * 6,
  duration: 5 + Math.random() * 8,
}));

export function PartnerLeftOverlay({ countdown: countdownVal }: { countdown: number }) {
  return (
    <div
      className="fixed inset-0 z-[1400] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(15,12,41,0.9) 50%, rgba(0,0,0,0.85) 100%)",
        backdropFilter: "blur(8px)",
      }}
    >
      <style>{ANIMATIONS}</style>

      {/* Floating particles */}
      {OVERLAY_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-[-10px] rounded-full bg-[#667eea]/30"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animation: `float ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}

      <div className="relative backdrop-blur-2xl bg-white/[0.06] border border-white/[0.1] rounded-3xl px-6 py-10 sm:px-12 sm:py-12 flex flex-col items-center gap-5 max-w-[400px] w-[90%] shadow-[0_8px_48px_rgba(0,0,0,0.5)]">
        {/* Pulsing rings */}
        <div className="relative w-[80px] h-[80px] mb-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-[40px] h-[40px] -mt-[20px] -ml-[20px] rounded-full border-2 border-[#667eea]/40"
              style={{
                animation: `pulseRing 2s ${i * 0.6}s ease-out infinite`,
              }}
            />
          ))}
          <div className="absolute top-1/2 left-1/2 w-3 h-3 -mt-1.5 -ml-1.5 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] shadow-[0_0_16px_rgba(102,126,234,0.5)]" />
        </div>

        <h5 className="text-white font-bold text-center text-xl tracking-wide">
          Partner left
        </h5>
        <p className="text-white/45 text-center text-sm">
          Finding someone new in
        </p>
        <h2
          className="text-transparent bg-clip-text bg-gradient-to-r from-[#667eea] to-[#a78bfa] font-extrabold text-5xl sm:text-6xl"
          style={{ animation: "countdown 1s ease-in-out infinite" }}
        >
          {countdownVal}
        </h2>
      </div>
    </div>
  );
}
