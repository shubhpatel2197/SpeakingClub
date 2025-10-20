import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  Divider,
  Button,
  Avatar,
  Stack,
  Backdrop,
  Paper,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import LogoutIcon from "@mui/icons-material/Logout";
import { styled } from "@mui/material/styles";
import ChatPanel from "../components/room/ChatPanel";
// import VideoArea from "../components/room/VideoArea"; // keep if you still need it
import { useAuthContext } from "../context/AuthProvider";
import { useMediasoup } from "../hooks/useMediasoup";
import { useNavigate, useParams } from "react-router-dom";
import { useCurrentGroup } from "../context/CurrentGroupContext";
import { useSnackbar } from "../context/SnackbarProvider";

const CHAT_WIDTH = 340; // must match ChatPanel width

const RoomContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "91vh",
  width: "100%",
  background:
    theme.palette.mode === "dark"
      ? "linear-gradient(180deg, #121212 0%, #1e1e1e 100%)"
      : "linear-gradient(180deg, #f7f9fc 0%, #ffffff 100%)",
  border: `2px solid ${theme.palette.divider}`,
}));

const TopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1, 3),
  borderBottom: `2px solid ${theme.palette.divider}`,
  backdropFilter: "blur(6px)",
}));

const MainArea = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  position: "relative",
  width: "100%",
}));

const BottomBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(1),
  borderTop: `2px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  position: "relative",
}));

const MiddleWrap = styled(Box)(() => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  flex: 1,
}));

const MembersScroll = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  overflowX: "auto",
  padding: theme.spacing(0, 1),
  alignItems: "center",
  "&::-webkit-scrollbar": { height: 8 },
  "&::-webkit-scrollbar-thumb": {
    background: theme.palette.divider,
    borderRadius: 20,
  },
}));

const MemberItem = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minWidth: 88,
  gap: 6,
  padding: theme.spacing(0.5),
}));

type RoomParticipant = {
  id: string;
  name?: string | null;
  muted?: boolean;
};

function avatarInitials(nameOrId?: string | null) {
  const s = nameOrId ?? "U";
  return s
    .split(" ")
    .map((t) => (t ? t[0] : ""))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function deterministicColor(name?: string) {
  const colors = [
    "#1976D2",
    "#9C27B0",
    "#E91E63",
    "#FF9800",
    "#4CAF50",
    "#0097A7",
    "#795548",
    "#F44336",
  ];
  const k = name ?? String(Math.random());
  let h = 0;
  for (let i = 0; i < k.length; i++) h = k.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export default function Room() {
  const { showSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { id: roomId } = useParams<{ id: string }>();
  const { user } = useAuthContext();
  const {
    joinRoom,
    leaveRoom,
    toggleMic,
    micOn,
    participants: rtcParticipants,
    messages,
    sendChat,
    setTyping,
  } = useMediasoup();
  const group = useCurrentGroup();

  // add at the top with the other consts
  const CHAT_WIDTH = 340; // matches ChatPanel width
  const VIDEO_BOX = { w: 1000, h: 440 }; // fixed size target (16:9)

  const membersCount = useMemo(() => {
    if (!group) return 0;
    if (
      typeof (group as any)._count === "object" &&
      typeof (group as any)._count.memberships === "number"
    ) {
      return (group as any)._count.memberships;
    }
    if (Array.isArray((group as any).memberships))
      return (group as any).memberships.length;
    if (rtcParticipants) return rtcParticipants.length;
    return 0;
  }, [group, rtcParticipants]);

  const [displayMembers, setDisplayMembers] = useState<RoomParticipant[]>([]);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  const isOwner = !!(
    user?.id &&
    (group as any)?.owner &&
    user.id === (group as any).owner.id
  );

  useEffect(() => {
    const map = new Map<string, RoomParticipant>();
    rtcParticipants.forEach((p: any) => {
      const prev = map.get(p.id);
      map.set(p.id, {
        id: p.id,
        name: p.name ?? prev?.name ?? p.id,
        muted: typeof p.muted === "boolean" ? p.muted : prev?.muted,
      });
    });
    if (user?.id && !map.has(user.id)) {
      map.set(user.id, { id: user.id, name: user.name ?? user.email ?? "You" });
    }
    setDisplayMembers(Array.from(map.values()));
  }, [rtcParticipants, user?.id, user?.name, user?.email]);

  useEffect(() => {
    if (!roomId) return;
    const membersList = (group as any)?.memberships || [];
    const isMember = membersList.some((m: any) => {
      const mid = (m as any).user?.id ?? (m as any).userId ?? (m as any).id;
      return mid && mid === user?.id;
    });
    if (isMember) {
      navigate('/', { replace: true });;
      return;
    }
    joinRoom(roomId);
  }, [roomId, joinRoom]);

  const handleLeaveClick = async () => {
    setConfirmLeaveOpen(true);
  };

  const confirmLeave = async () => {
    leaveRoom();
    setConfirmLeaveOpen(false);
  };

  const cancelLeave = () => setConfirmLeaveOpen(false);

  const currentUserId = user?.id;

  const nameMapRef = React.useRef<Record<string, string>>({});

  const nameMap = useMemo(() => {
    const newMap = { ...nameMapRef.current };
    for (const m of displayMembers) {
      newMap[m.id] = m.name || m.id;
    }
    nameMapRef.current = newMap;
    return newMap;
  }, [displayMembers]);

  return (
    <RoomContainer>
      <TopBar>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            {(group as any)?.description ?? "Group room"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Language: {(group as any)?.language ?? "—"} • Level:{" "}
            {(group as any)?.level ?? "—"} • Members: {membersCount}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              navigator.clipboard
                ?.writeText(window.location.href)
                .then(() => showSnackbar("Copied link to clipboard"))
                .catch(() => showSnackbar("Failed to copy link to clipboard"));
            }}
          >
            Invite
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<LogoutIcon />}
            onClick={handleLeaveClick}
          >
            Leave
          </Button>
        </Stack>
      </TopBar>

      <MiddleWrap>
        {/* Reserve space on the right so content never sits behind ChatPanel */}
        <MainArea sx={{ pr: `${CHAT_WIDTH}px` }}>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // p: 2,
            }}
          >
            {/* Fixed-size video box with responsive fallback so it doesn't overflow on small screens */}
            <Box
              sx={{
                mr: 43,
                width: { md: VIDEO_BOX.w },
                height: { md: VIDEO_BOX.h },
                // maxWidth: `calc(100% - ${CHAT_WIDTH}px)`,
                // maxHeight: "calc(100% - 32px)",
                bgcolor: "#000",
                borderRadius: 2,
                boxShadow: 3,
                overflow: "hidden",
                zIndex: 0, // ensure it stays below the ChatPanel overlay
              }}
            >
              <video
                controls
                autoPlay
                muted
                loop
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              />
            </Box>
          </Box>
        </MainArea>

        {/* Also reserve the same width for the BottomBar so it never goes behind the chat */}
        <BottomBar sx={{ pr: `${CHAT_WIDTH}px` }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
            <Tooltip
              title={micOn ? "Turn off microphone" : "Turn on microphone"}
            >
              <IconButton
                onClick={toggleMic}
                color={micOn ? "primary" : "default"}
                sx={{
                  bgcolor: micOn ? "primary.light" : undefined,
                  "&:hover": { bgcolor: micOn ? "primary.main" : undefined },
                }}
              >
                {micOn ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          </Stack>

          <MembersScroll sx={{ flex: 1 }}>
            {displayMembers.map((p) => {
              const isCurrent = p.id === currentUserId;
              const displayName = p.name ?? p.id;
              const showMicOn = isCurrent
                ? micOn
                : p.muted === undefined
                  ? true
                  : !p.muted;
              return (
                <MemberItem key={p.id}>
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: deterministicColor(displayName),
                      fontSize: 16,
                    }}
                  >
                    {avatarInitials(displayName)}
                  </Avatar>
                  <Typography
                    sx={{
                      fontSize: 12,
                      mt: 0.25,
                      textAlign: "center",
                      maxWidth: 70,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {displayName}
                  </Typography>
                  <Tooltip
                    title={
                      isCurrent
                        ? showMicOn
                          ? "Mute"
                          : "Unmute"
                        : showMicOn
                          ? "Mic on"
                          : "Mic off"
                    }
                  >
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (!isCurrent) return;
                        toggleMic();
                      }}
                      sx={{
                        bgcolor: showMicOn
                          ? "rgba(25,118,210,0.12)"
                          : undefined,
                        color: showMicOn ? "primary.main" : "text.secondary",
                      }}
                    >
                      {showMicOn ? (
                        <MicIcon fontSize="small" />
                      ) : (
                        <MicOffIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                </MemberItem>
              );
            })}
          </MembersScroll>
        </BottomBar>

        {/* Chat stays absolute on the right */}
        <ChatPanel
          onClose={() => {}}
          messages={messages}
          onSend={sendChat}
          onTyping={setTyping}
          nameMap={nameMap}
          selfId={currentUserId}
        />
      </MiddleWrap>

      <Backdrop
        open={confirmLeaveOpen}
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.modal + 1,
          backdropFilter: "blur(2px)",
        }}
      >
        <Paper
          elevation={8}
          sx={(theme) => ({
            width: 420,
            maxWidth: "90vw",
            p: 3,
            borderRadius: 2,
            boxShadow:
              theme.palette.mode === "dark"
                ? "0 8px 30px rgba(0,0,0,0.6)"
                : "0 8px 24px rgba(0,0,0,0.15)",
          })}
        >
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Leave room?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {isOwner
              ? "You’re the owner. Leaving may close the session for everyone."
              : "You can rejoin anytime using the invite link."}
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={cancelLeave} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={confirmLeave}
              color="error"
              variant="contained"
              startIcon={<LogoutIcon />}
            >
              Leave
            </Button>
          </Stack>
        </Paper>
      </Backdrop>
    </RoomContainer>
  );
}
