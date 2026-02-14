import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  useMediaQuery,
} from "@mui/material";
import { styled, useTheme, keyframes } from "@mui/material/styles";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import LogoutIcon from "@mui/icons-material/Logout";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import ChatPanel from "../room/ChatPanel";
import VideoArea from "../room/VideoArea";

const CHAT_WIDTH = 340;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const countdown = keyframes`
  0% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
`;

const RoomContainer = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  width: "100%",
  background: "linear-gradient(180deg, #0a0a1a 0%, #151530 100%)",
  animation: `${fadeIn} 0.4s ease-out`,
}));

const TopBar = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(12px)",
  backgroundColor: "rgba(255, 255, 255, 0.03)",
}));

const MiddleWrap = styled(Box)(() => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
}));

const MainArea = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  position: "relative",
  width: "100%",
  minHeight: 0,
}));

const BottomBar = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  padding: "12px 16px",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  backgroundColor: "rgba(255, 255, 255, 0.03)",
  backdropFilter: "blur(12px)",
}));

const NextButton = styled(Button)(() => ({
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: "1rem",
  padding: "10px 36px",
  borderRadius: 50,
  textTransform: "none",
  boxShadow: "0 4px 20px rgba(102, 126, 234, 0.4)",
  transition: "all 0.2s ease",
  "&:hover": {
    transform: "scale(1.05)",
    boxShadow: "0 6px 30px rgba(102, 126, 234, 0.6)",
    background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
  },
}));

const MicButton = styled(IconButton)<{ active?: number }>(({ active }) => ({
  width: 48,
  height: 48,
  backgroundColor: active
    ? "rgba(102, 126, 234, 0.2)"
    : "rgba(255, 255, 255, 0.08)",
  color: active ? "#667eea" : "rgba(255, 255, 255, 0.5)",
  border: `1px solid ${active ? "rgba(102, 126, 234, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
  transition: "all 0.2s ease",
  "&:hover": {
    backgroundColor: active
      ? "rgba(102, 126, 234, 0.3)"
      : "rgba(255, 255, 255, 0.12)",
  },
}));

const LeaveButton = styled(Button)(() => ({
  color: "#f44336",
  borderColor: "rgba(244, 67, 54, 0.4)",
  fontWeight: 600,
  borderRadius: 50,
  padding: "8px 24px",
  textTransform: "none",
  "&:hover": {
    borderColor: "#f44336",
    backgroundColor: "rgba(244, 67, 54, 0.08)",
  },
}));

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  partnerName: string | null;
  chatDuration: number;
  onNext: () => void;
  onLeave: () => void;
  toggleMic: () => void;
  micOn: boolean;
  messages: any[];
  sendChat: (text: string) => void;
  setTyping: (on: boolean) => void;
  participants: any[];
  selfId?: string;
  isSharingScreen: boolean;
  screenSharerId: string | null;
  screenSharerName: string | null;
};

export default function RandomChatRoom({
  partnerName,
  chatDuration,
  onNext,
  onLeave,
  toggleMic,
  micOn,
  messages,
  sendChat,
  setTyping,
  participants,
  selfId,
  isSharingScreen,
  screenSharerId,
  screenSharerName,
}: Props) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [chatOpen, setChatOpen] = useState(false);

  const currentUserId = selfId;
  const foreignCount = useMemo(() => {
    return messages.reduce((acc, m) => acc + (m.from !== currentUserId ? 1 : 0), 0);
  }, [messages, currentUserId]);

  const [unread, setUnread] = useState(0);
  const lastSeenForeignRef = useRef(0);

  useEffect(() => {
    if (chatOpen) {
      lastSeenForeignRef.current = foreignCount;
      setUnread(0);
    }
  }, [chatOpen, foreignCount]);

  useEffect(() => {
    if (!chatOpen && foreignCount > lastSeenForeignRef.current) {
      setUnread(foreignCount - lastSeenForeignRef.current);
    }
  }, [chatOpen, foreignCount]);

  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of participants) {
      map[p.id || p.userId] = p.name || p.userId || "User";
    }
    return map;
  }, [participants]);

  const reservedRight = isMdUp && chatOpen ? `${CHAT_WIDTH}px` : "0px";

  return (
    <RoomContainer>
      <TopBar>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <FiberManualRecordIcon
            sx={{ fontSize: 10, color: "#4caf50", filter: "drop-shadow(0 0 4px #4caf50)" }}
          />
          <Typography
            variant="subtitle1"
            sx={{
              color: "#fff",
              fontWeight: 600,
              maxWidth: { xs: "40vw", md: "30vw" },
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {partnerName || "Stranger"}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "rgba(255, 255, 255, 0.4)",
              fontVariantNumeric: "tabular-nums",
              ml: 1,
            }}
          >
            {formatDuration(chatDuration)}
          </Typography>
        </Box>

        <Tooltip title={chatOpen ? "Hide chat" : "Show chat"}>
          <IconButton
            onClick={() => {
              const next = !chatOpen;
              setChatOpen(next);
              if (next) setUnread(0);
            }}
            sx={{
              color: "rgba(255, 255, 255, 0.7)",
              position: "relative",
              "&:hover": { color: "#fff" },
            }}
          >
            <ChatBubbleOutlineIcon />
            {!chatOpen && unread > 0 && (
              <Box
                sx={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: "#667eea",
                  boxShadow: "0 0 6px #667eea",
                }}
              />
            )}
          </IconButton>
        </Tooltip>
      </TopBar>

      <MiddleWrap>
        <MainArea>
          <VideoArea
            isSharingScreen={isSharingScreen}
            screenSharerId={screenSharerId}
            screenSharerName={screenSharerName}
            chatWidth={isMdUp && chatOpen ? CHAT_WIDTH : 0}
          />
        </MainArea>

        <BottomBar sx={{ pr: reservedRight }}>
          <LeaveButton variant="outlined" startIcon={<LogoutIcon />} onClick={onLeave}>
            Leave
          </LeaveButton>

          <MicButton active={micOn ? 1 : 0} onClick={toggleMic}>
            {micOn ? <MicIcon /> : <MicOffIcon />}
          </MicButton>

          <NextButton startIcon={<SkipNextIcon />} onClick={onNext}>
            Next
          </NextButton>
        </BottomBar>

        {chatOpen && (
          <ChatPanel
            onClose={() => setChatOpen(false)}
            messages={messages}
            onSend={(t) => {
              sendChat(t);
              setUnread(0);
              lastSeenForeignRef.current = foreignCount;
            }}
            onTyping={setTyping}
            nameMap={nameMap}
            selfId={currentUserId}
            panelWidth={CHAT_WIDTH}
            mobileFullScreen
          />
        )}
      </MiddleWrap>
    </RoomContainer>
  );
}

/** Overlay shown when partner disconnects, with auto-countdown */
export function PartnerLeftOverlay({ countdown: countdownVal }: { countdown: number }) {
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Box
        sx={{
          backdropFilter: "blur(24px)",
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 5,
          px: { xs: 4, sm: 6 },
          py: { xs: 4, sm: 5 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          maxWidth: 400,
          width: "90%",
        }}
      >
        <Typography
          variant="h5"
          sx={{ color: "#fff", fontWeight: 700, textAlign: "center" }}
        >
          Partner left
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "rgba(255, 255, 255, 0.5)", textAlign: "center" }}
        >
          Finding someone new in
        </Typography>
        <Typography
          variant="h2"
          sx={{
            color: "#667eea",
            fontWeight: 800,
            animation: `${countdown} 1s ease-in-out infinite`,
          }}
        >
          {countdownVal}
        </Typography>
      </Box>
    </Box>
  );
}
