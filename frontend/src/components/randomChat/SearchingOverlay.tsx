import { Box, Typography, Button } from "@mui/material";
import { keyframes } from "@emotion/react";

const pulseRing = keyframes`
  0% { transform: scale(0.4); opacity: 0.8; }
  100% { transform: scale(2.8); opacity: 0; }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const float = keyframes`
  0% { transform: translateY(0px) scale(1); opacity: 0.5; }
  100% { transform: translateY(-100vh) scale(0.2); opacity: 0; }
`;

const dots = keyframes`
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
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
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        backgroundSize: "400% 400%",
        animation: `${gradientShift} 8s ease infinite`,
        overflow: "hidden",
      }}
    >
      {/* Floating particles */}
      {PARTICLES.map((p) => (
        <Box
          key={p.id}
          sx={{
            position: "absolute",
            bottom: -10,
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.3)",
            animation: `${float} ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}

      {/* Glass card */}
      <Box
        sx={{
          position: "relative",
          backdropFilter: "blur(24px)",
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 5,
          px: { xs: 4, sm: 6 },
          py: { xs: 5, sm: 6 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          maxWidth: 400,
          width: "90%",
        }}
      >
        {/* Pulsing rings */}
        <Box sx={{ position: "relative", width: 120, height: 120 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 60,
                height: 60,
                marginTop: "-30px",
                marginLeft: "-30px",
                borderRadius: "50%",
                border: "2px solid rgba(102, 126, 234, 0.6)",
                animation: `${pulseRing} 2s ${i * 0.6}s ease-out infinite`,
              }}
            />
          ))}
          {/* Center dot */}
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 16,
              height: 16,
              marginTop: "-8px",
              marginLeft: "-8px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              boxShadow: "0 0 20px rgba(102, 126, 234, 0.6)",
            }}
          />
        </Box>

        <Typography
          variant="h5"
          sx={{
            color: "#fff",
            fontWeight: 700,
            textAlign: "center",
            letterSpacing: 0.5,
          }}
        >
          Looking for someone
          <Box
            component="span"
            sx={{
              "&::after": {
                content: "'...'",
                animation: `${dots} 1.5s steps(3) infinite`,
              },
            }}
          />
        </Typography>

        <Typography
          variant="body1"
          sx={{
            color: "rgba(255, 255, 255, 0.5)",
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTime(searchTime)}
        </Typography>

        <Button
          variant="outlined"
          onClick={onCancel}
          sx={{
            mt: 1,
            color: "rgba(255, 255, 255, 0.8)",
            borderColor: "rgba(255, 255, 255, 0.25)",
            borderRadius: 50,
            px: 4,
            textTransform: "none",
            fontWeight: 600,
            "&:hover": {
              borderColor: "rgba(255, 255, 255, 0.5)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            },
          }}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
