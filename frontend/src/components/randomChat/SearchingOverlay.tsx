import { Button } from "../ui/button";

const ANIMATIONS = `
@keyframes pulseRing {
  0% { transform: scale(0.4); opacity: 0.8; }
  100% { transform: scale(2.8); opacity: 0; }
}
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes float {
  0% { transform: translateY(0px) scale(1); opacity: 0.5; }
  100% { transform: translateY(-100vh) scale(0.2); opacity: 0; }
}
@keyframes dots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
}
`;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  searchTime: number;
  onCancel: () => void;
};

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  size: 2 + Math.random() * 4,
  delay: Math.random() * 8,
  duration: 6 + Math.random() * 10,
}));

export default function SearchingOverlay({ searchTime, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-[1300] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 8s ease infinite",
      }}
    >
      <style>{ANIMATIONS}</style>

      {/* Floating particles */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-[-10px] rounded-full bg-white/30"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animation: `float ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}

      {/* Glass card */}
      <div className="relative backdrop-blur-2xl bg-white/5 border border-white/10 rounded-2xl px-8 py-10 sm:px-12 sm:py-14 flex flex-col items-center gap-6 max-w-[400px] w-[90%]">
        {/* Pulsing rings */}
        <div className="relative w-[120px] h-[120px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-[60px] h-[60px] -mt-[30px] -ml-[30px] rounded-full border-2 border-[#667eea]/60"
              style={{
                animation: `pulseRing 2s ${i * 0.6}s ease-out infinite`,
              }}
            />
          ))}
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] shadow-[0_0_20px_rgba(102,126,234,0.6)]" />
        </div>

        <h5 className="text-white font-bold text-center tracking-wide text-xl">
          Looking for someone
          <span className="after:content-['...'] after:animate-[dots_1.5s_steps(3)_infinite] inline-block w-4 text-left" />
        </h5>

        <p className="text-white/50 font-medium tabular-nums">
          {formatTime(searchTime)}
        </p>

        <Button
          variant="outline"
          onClick={onCancel}
          className="mt-2 text-white/80 border-white/25 rounded-full px-8 hover:bg-white/5 hover:text-white hover:border-white/50 transition-colors"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
