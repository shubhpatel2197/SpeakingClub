import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Send } from "lucide-react";
import MemberAvatar from "../ui/MemberAvatar";

type ChatMessage = { id: string; from: string; text: string; ts: number };

interface ChatPanelProps {
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onTyping: (on: boolean) => void;
  nameMap?: Record<string, string>;
  selfId?: string;
  panelWidth?: number;
  mobileFullScreen?: boolean;
}

const isIOSMobile = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  typeof window !== "undefined" &&
  window.innerWidth < 900;

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 160;

export default function ChatPanel({
  onClose,
  messages,
  onSend,
  onTyping,
  nameMap = {},
  selfId,
  panelWidth = 340,
  mobileFullScreen = true,
}: ChatPanelProps) {
  const [isMdUp, setIsMdUp] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMdUp(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const [kbInset, setKbInset] = useState(0);
  const [composerH, setComposerH] = useState(0);

  const updateComposerHeight = () => {
    if (composerRef.current) setComposerH(composerRef.current.offsetHeight || 0);
  };

  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const needed = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, el.scrollHeight));
    el.style.height = `${needed}px`;
    el.style.overflowY = needed >= MAX_HEIGHT ? "auto" : "hidden";
    updateComposerHeight();
  };

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const base = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, el.scrollHeight || MIN_HEIGHT));
    el.style.height = `${base}px`;
    el.style.overflowY = "hidden";
    updateComposerHeight();
  }, []);

  useEffect(() => {
    if (!isIOSMobile() || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onVV = () => {
      const overlap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setKbInset(overlap);
      updateComposerHeight();
    };
    vv.addEventListener("resize", onVV);
    vv.addEventListener("scroll", onVV);
    onVV();
    return () => {
      vv.removeEventListener("resize", onVV);
      vv.removeEventListener("scroll", onVV);
    };
  }, []);

  const displayMessages = useMemo(() => {
    return messages.map((m) => {
      const isSelf = m.from === "me" || m.from === selfId;
      const displayName = isSelf ? "You" : nameMap[m.from] || m.from;
      return { ...m, isSelf, displayName };
    });
  }, [messages, nameMap, selfId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [displayMessages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    const el = taRef.current;
    if (el) {
      el.value = "";
      el.style.height = "auto";
      const base = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, el.scrollHeight || MIN_HEIGHT));
      el.style.height = `${base}px`;
      el.style.overflowY = "hidden";
    }
    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }
    updateComposerHeight();
  }

  function handleChange(v: string) {
    setInput(v);
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        onTyping(false);
      }, 1000);
    }
  }

  const widthStyle = isMdUp ? `${panelWidth}px` : mobileFullScreen ? "100%" : `${panelWidth}px`;

  return (
    <div
      className={`flex flex-col bg-[#0e0e12] text-foreground ${isMdUp
          ? "absolute right-0 top-0 bottom-0 border-l border-border z-40"
          : "fixed inset-0 z-[100] shadow-xl"
        }`}
      style={{ width: widthStyle }}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-[#141418]">
        <h3 className="font-display font-semibold text-sm text-foreground">Chat</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 transition-colors text-foreground/60 hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 p-3 overflow-y-auto overscroll-contain"
        style={{
          paddingBottom: `${composerH + 8}px`,
          ...(isIOSMobile() ? { marginBottom: `${kbInset}px` } : {}),
        }}
      >
        {displayMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 pt-1">Messages will appear here</p>
        ) : (
          <div className="space-y-2">
            {displayMessages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-2 ${m.isSelf ? "justify-end" : "justify-start"}`}
              >
                {!m.isSelf && (
                  <div className="shrink-0">
                    <MemberAvatar
                      member={{ id: m.from, name: m.displayName }}
                      avatarSize={28}
                      withName={false}
                    />
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3 py-2 rounded-xl text-white ${m.isSelf
                      ? "bg-gradient-to-br from-green-500 to-green-600"
                      : "bg-gradient-to-br from-slate-700 to-slate-800"
                    }`}
                >
                  <div className="flex justify-between items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-medium opacity-80">{m.displayName}</span>
                    <span className="text-[10px] opacity-60" title={new Date(m.ts).toLocaleTimeString()}>
                      {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        ref={composerRef}
        className={`p-2 bg-[#1a1a1e] border-t border-border ${isIOSMobile() ? "fixed left-0 right-0 bottom-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] z-[110]" : ""
          }`}
      >
        <div className="flex items-center gap-2 w-full">
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Type a message"
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
            autoCapitalize="none"
            className="flex-1 min-w-0 bg-[#1a1a1e] text-foreground border border-border rounded-xl px-3 py-2 text-[16px] leading-5 font-sans outline-none resize-none placeholder:text-foreground/40 focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
            style={{ maxHeight: MAX_HEIGHT }}
          />
          <button
            onClick={handleSend}
            className="shrink-0 p-2.5 rounded-xl border border-border text-foreground hover:bg-white/5 hover:text-primary transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
