import { Box, Typography, Button } from "@mui/material";
import { keyframes } from "@emotion/react";
import ShuffleIcon from "@mui/icons-material/Shuffle";

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const float = keyframes`
  0% { transform: translateY(0px) scale(1); opacity: 0.4; }
  100% { transform: translateY(-100vh) scale(0.2); opacity: 0; }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.5); }
  50% { box-shadow: 0 0 0 20px rgba(102, 126, 234, 0); }
`;

const subtleFloat = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
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
    <Box
      sx={{
        position: "relative",
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        backgroundSize: "400% 400%",
        animation: `${gradientShift} 12s ease infinite`,
        overflow: "hidden",
        px: 2,
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
            background: "rgba(255, 255, 255, 0.2)",
            animation: `${float} ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}

      {/* Hero card */}
      <Box
        sx={{
          position: "relative",
          backdropFilter: "blur(24px)",
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 6,
          px: { xs: 3, sm: 6 },
          py: { xs: 5, sm: 7 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          maxWidth: 520,
          width: "100%",
          animation: `${subtleFloat} 4s ease-in-out infinite`,
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 1,
            boxShadow: "0 8px 32px rgba(102, 126, 234, 0.3)",
          }}
        >
          <ShuffleIcon sx={{ fontSize: 36, color: "#fff" }} />
        </Box>

        <Typography
          variant="h3"
          sx={{
            color: "#fff",
            fontWeight: 800,
            textAlign: "center",
            textShadow: "0 0 40px rgba(102, 126, 234, 0.3)",
            fontSize: { xs: "2rem", sm: "2.75rem" },
            lineHeight: 1.2,
          }}
        >
          Meet Someone New
        </Typography>

        <Typography
          variant="body1"
          sx={{
            color: "rgba(255, 255, 255, 0.6)",
            textAlign: "center",
            maxWidth: 360,
            lineHeight: 1.6,
            fontSize: { xs: "0.95rem", sm: "1.05rem" },
          }}
        >
          Start a random video chat with people around the world. One click away
          from your next conversation.
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          sx={{
            mt: 3,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.15rem",
            padding: "14px 56px",
            borderRadius: 50,
            textTransform: "none",
            boxShadow: "0 4px 24px rgba(102, 126, 234, 0.4)",
            animation: `${pulseGlow} 2.5s ease-in-out infinite`,
            transition: "all 0.25s ease",
            "&:hover": {
              transform: "scale(1.06)",
              boxShadow: "0 8px 36px rgba(102, 126, 234, 0.55)",
              background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
            },
          }}
        >
          Start
        </Button>

        <Typography
          variant="caption"
          sx={{
            color: "rgba(255, 255, 255, 0.3)",
            mt: 1,
            textAlign: "center",
          }}
        >
          By clicking Start, you agree to be respectful to others
        </Typography>
      </Box>
    </Box>
  );
}
