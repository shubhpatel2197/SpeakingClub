import { Button } from "../ui/button";
import { MessageCircle } from "lucide-react";

const ANIMATIONS = `
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes float {
  0% { transform: translateY(0px) scale(1); opacity: 0.4; }
  100% { transform: translateY(-100vh) scale(0.2); opacity: 0; }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.5); }
  50% { box-shadow: 0 0 0 20px rgba(102, 126, 234, 0); }
}
@keyframes subtleFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
`;

const PARTICLES = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  size: 2 + Math.random() * 5,
  delay: Math.random() * 10,
  duration: 8 + Math.random() * 12,
}));

type Props = {
  onStart: () => void;
};

export default function RandomChatLanding({ onStart }: Props) {
  return (
    <div
      className="relative min-h-[calc(100dvh-64px)] flex flex-col items-center justify-center overflow-hidden px-4"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 12s ease infinite",
      }}
    >
      <style>{ANIMATIONS}</style>

      {/* Floating particles */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-[-10px] rounded-full bg-white/20"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animation: `float ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}

      {/* Hero card */}
      <div
        className="relative backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl px-6 py-10 sm:px-12 sm:py-14 flex flex-col items-center gap-4 max-w-[520px] w-full"
        style={{
          animation: "subtleFloat 4s ease-in-out infinite",
        }}
      >
        {/* Icon */}
        <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center mb-2 shadow-lg shadow-[#667eea]/30">
          <MessageCircle className="w-9 h-9 text-white" />
        </div>

        <h3 className="text-white font-extrabold text-center text-3xl sm:text-4xl leading-tight drop-shadow-[0_0_40px_rgba(102,126,234,0.3)]">
          Chat with a Stranger
        </h3>

        <p className="text-white/60 text-center max-w-[360px] leading-relaxed text-sm sm:text-base">
          Start a random text chat with people around the world. One click away
          from your next conversation.
        </p>

        <Button
          size="lg"
          onClick={onStart}
          className="mt-6 bg-gradient-to-br from-[#667eea] to-[#764ba2] hover:from-[#764ba2] hover:to-[#667eea] text-white font-bold text-lg py-6 px-14 rounded-full shadow-[0_4px_24px_rgba(102,126,234,0.4)] transition-all duration-250 hover:scale-105 hover:shadow-[0_8px_36px_rgba(102,126,234,0.55)] border-0"
          style={{
            animation: "pulseGlow 2.5s ease-in-out infinite",
          }}
        >
          Start
        </Button>

        <span className="text-white/30 mt-2 text-center text-xs">
          By clicking Start, you agree to be respectful to others
        </span>
      </div>
    </div>
  );
}
