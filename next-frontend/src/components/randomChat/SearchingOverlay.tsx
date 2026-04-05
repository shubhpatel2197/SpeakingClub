'use client'

import { Button } from "../ui/button";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  searchTime: number;
  onCancel: () => void;
};

export default function SearchingOverlay({ searchTime, onCancel }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Pulsing rings */}
      <div className="relative w-[80px] h-[80px] mb-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-[40px] h-[40px] -mt-[20px] -ml-[20px] rounded-full border-2 border-[#7F9486]/40 animate-[pulseRing_2s_ease-out_infinite]"
            style={{ animationDelay: `${i * 0.6}s` }}
          />
        ))}
        <div className="absolute top-1/2 left-1/2 w-3.5 h-3.5 -mt-[7px] -ml-[7px] rounded-full bg-[#7F9486] shadow-[0_0_16px_rgba(127,148,134,0.5)]" />
      </div>

      <p className="text-foreground font-semibold text-base mb-1">
        Looking for someone...
      </p>
      <p className="text-muted-foreground font-mono tabular-nums text-sm mb-4">
        {formatTime(searchTime)}
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={onCancel}
        className="rounded-xl px-6"
      >
        Cancel
      </Button>

      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(0.4); opacity: 0.8; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
