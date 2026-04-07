'use client'

import { useEffect, useState } from "react";
import { X, Heart } from "lucide-react";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  searchTime: number;
  onCancel: () => void;
};

// Candidate avatars — pulled from the same DiceBear set used in Profile
const AVATAR_BG = "7f9486";
const CANDIDATES = [
  // Girls
  `https://api.dicebear.com/9.x/lorelei/svg?seed=Sophia&backgroundColor=${AVATAR_BG}`,
  `https://api.dicebear.com/9.x/lorelei/svg?seed=Jasmine&backgroundColor=${AVATAR_BG}`,
  `https://api.dicebear.com/9.x/lorelei/svg?seed=Ava&backgroundColor=${AVATAR_BG}`,
  // Boys
  `https://api.dicebear.com/9.x/notionists/svg?seed=Viking&backgroundColor=${AVATAR_BG}`,
  `https://api.dicebear.com/9.x/notionists/svg?seed=Lumberjack&backgroundColor=${AVATAR_BG}`,
  `https://api.dicebear.com/9.x/notionists/svg?seed=Captain&backgroundColor=${AVATAR_BG}`,
];

export default function SearchingOverlay({ searchTime, onCancel }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % CANDIDATES.length), 700);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative flex h-full min-h-[460px] w-full flex-col items-center justify-center overflow-hidden px-4 py-8 sm:min-h-[560px] sm:px-6 sm:py-10"
      style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* Ambient background — subtle grid + center spotlight */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(127,148,134,0.14), transparent 55%),
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 48px 48px, 48px 48px",
        }}
      />

      {/* Match stage — radar + avatar deck */}
      <div className="relative z-10 mb-7 flex h-[240px] w-[240px] items-center justify-center sm:mb-8 sm:h-[320px] sm:w-[320px]">
        {/* Soft center glow */}
        <div
          className="absolute inset-10 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(127,148,134,0.22), rgba(217,122,92,0.10) 55%, transparent 75%)",
            filter: "blur(6px)",
          }}
        />

        {/* Rotating sweep — faint */}
        <div
          className="absolute inset-2 rounded-full animate-[spin_10s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0% 70%, rgba(127,148,134,0.35) 88%, transparent 100%)",
            mask: "radial-gradient(circle, transparent 62%, black 63%, black 66%, transparent 67%)",
            WebkitMask:
              "radial-gradient(circle, transparent 62%, black 63%, black 66%, transparent 67%)",
          }}
        />

        {/* Orbiting candidate avatars */}
        {CANDIDATES.map((src, i) => {
          const angle = (i / CANDIDATES.length) * Math.PI * 2;
          const radius = 92;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const active = i === activeIdx;
          return (
            <div
              key={i}
              className={`absolute transition-all duration-500 ${active ? "z-20" : "opacity-60"}`}
              style={{ transform: `translate(${x}px, ${y}px) scale(${active ? 1.12 : 0.9})` }}
            >
              <div
                className={`h-11 w-11 overflow-hidden rounded-full bg-[#1A1D24] ring-2 transition-all sm:h-12 sm:w-12 ${
                  active
                    ? "ring-[#D97A5C] shadow-[0_0_24px_rgba(217,122,92,0.6)]"
                    : "ring-white/10"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
          );
        })}

        {/* Center "you" bubble */}
        <div className="relative z-10 flex h-[84px] w-[84px] items-center justify-center sm:h-[96px] sm:w-[96px]">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#e8a389,#d97a5c_58%,#8a5a49)] shadow-[0_0_50px_rgba(217,122,92,0.5)] animate-[breathe_3s_ease-in-out_infinite]" />
          <div className="absolute inset-2 rounded-full border border-white/15" />
          <Heart className="relative h-7 w-7 fill-white text-white sm:h-8 sm:w-8" />
        </div>
      </div>

      {/* Label + timer */}
      <div className="relative z-10 mb-6 flex flex-col items-center gap-1 px-3 text-center">
        <p className="text-base font-semibold tracking-tight text-foreground">
          Looking for someone<span className="text-[#D97A5C]">…</span>
        </p>
        <p className="max-w-[18rem] text-xs text-muted-foreground sm:text-sm">
          We are lining up a new conversation for you.
        </p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatTime(searchTime)}
        </p>
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="relative z-10 inline-flex h-11 w-full max-w-[18rem] items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-[#171b22] px-5 text-sm font-semibold text-muted-foreground transition-all hover:border-[#D97A5C]/50 hover:text-foreground active:scale-95"
      >
        <X className="h-4 w-4" />
        Cancel search
      </button>

      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1);    opacity: 0.95; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
