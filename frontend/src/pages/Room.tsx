import React, { useEffect, useMemo, useState, useRef } from "react";
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
  Badge,
  useMediaQuery,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import LogoutIcon from "@mui/icons-material/Logout";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import { styled, useTheme } from "@mui/material/styles";
import ChatPanel from "../components/room/ChatPanel";
import { useAuthContext } from "../context/AuthProvider";
import { useMediasoup } from "../hooks/useMediasoup";
import { useNavigate, useParams } from "react-router-dom";
import { useCurrentGroup } from "../context/CurrentGroupContext";
import { useSnackbar } from "../context/SnackbarProvider";
import VideoArea from "../components/room/VideoArea";

const CHAT_WIDTH = 340;

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
  minHeight: 0,
}));

const TopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1, 1.5),
  borderBottom: `2px solid ${theme.palette.divider}`,
  backdropFilter: "blur(6px)",
  gap: theme.spacing(1),
}));

const MainArea = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  position: "relative",
  width: "100%",
  minHeight: 0,
}));

const BottomBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.25),
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
  minHeight: 0,
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
  minWidth: 72,
  gap: 4,
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
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

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
    toggleScreenShare,
    isSharingScreen,
    screenSharerId,
    screenSharerName,
  } = useMediasoup();
  const group = useCurrentGroup();

  // Chat open state: open by default on md+; closed on mobile
  const [chatOpen, setChatOpen] = useState<boolean>(isMdUp);
  useEffect(() => {
    setChatOpen(isMdUp); // sync with breakpoint
  }, [isMdUp]);

  const [unread, setUnread] = useState(0);
  const prevLenRef = useRef(0);
  useEffect(() => {
    // simple unread badge when chat is closed
    if (!chatOpen && messages.length > prevLenRef.current) {
      setUnread((u) => u + (messages.length - prevLenRef.current));
    }
    prevLenRef.current = messages.length;
  }, [messages.length, chatOpen]);

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
    // const membersList = (group as any)?.memberships || [];
    // const isMember = membersList.some((m: any) => {
    //   const mid = (m as any).user?.id ?? (m as any).userId ?? (m as any).id;
    //   return mid && mid === user?.id;
    // });
    // if (isMember) {
    //   navigate("/", { replace: true });
    //   return;
    // }
    joinRoom(roomId);
  }, [roomId]);

  const handleLeaveClick = async () => setConfirmLeaveOpen(true);
  const confirmLeave = async () => {
    leaveRoom();
    setConfirmLeaveOpen(false);
  };
  const cancelLeave = () => setConfirmLeaveOpen(false);

  const currentUserId = user?.id;

  const nameMapRef = useRef<Record<string, string>>({});
  const nameMap = useMemo(() => {
    const newMap = { ...nameMapRef.current };
    for (const m of displayMembers) newMap[m.id] = m.name || m.id;
    nameMapRef.current = newMap;
    return newMap;
  }, [displayMembers]);

  const sharingBanner =
    screenSharerId && !isSharingScreen
      ? `${screenSharerName || "Someone"} is sharing`
      : isSharingScreen
      ? "You are sharing"
      : "";

  const reservedRight = isMdUp && chatOpen ? `${CHAT_WIDTH}px` : "0px";

  return (
    <RoomContainer>
      <TopBar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h6"
            fontWeight={600}
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: { xs: "60vw", md: "40vw" },
            }}
          >
            {(group as any)?.description ?? "Group room"}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: "none", sm: "block" } }}
          >
            Language: {(group as any)?.language ?? "—"} • Level:{" "}
            {(group as any)?.level ?? "—"} • Members: {membersCount}
          </Typography>
          {sharingBanner ? (
            <Typography variant="caption" color="primary">
              {sharingBanner}
            </Typography>
          ) : null}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Chat toggle (mobile shows badge) */}
          <Tooltip title={chatOpen ? "Hide chat" : "Show chat"}>
            <span>
              <IconButton
                onClick={() => {
                  const next = !chatOpen;
                  setChatOpen(next);
                  if (next) setUnread(0);
                }}
                color="primary"
                sx={{ display: { xs: "inline-flex", md: "inline-flex" } }}
              >
                <Badge color="error" badgeContent={!chatOpen ? unread : 0}>
                  <ChatBubbleOutlineIcon />
                </Badge>
              </IconButton>
            </span>
          </Tooltip>

          {/* Invite */}
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

          {/* Share / Stop */}
          <Tooltip
            title={
              isSharingScreen
                ? "Stop screen share"
                : screenSharerId && screenSharerId !== currentUserId
                ? `${screenSharerName || "Someone"} is already sharing`
                : "Start screen share"
            }
          >
            <span>
              <IconButton
                onClick={toggleScreenShare}
                color={isSharingScreen ? "error" : "primary"}
                disabled={!isSharingScreen && !!screenSharerId && screenSharerId !== currentUserId}
              >
                {isSharingScreen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            </span>
          </Tooltip>

          {/* Leave */}
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
        <MainArea>
          <VideoArea
            isSharingScreen={isSharingScreen}
            screenSharerId={screenSharerId}
            screenSharerName={screenSharerName}
            chatWidth={isMdUp && chatOpen ? CHAT_WIDTH : 0}
          />
        </MainArea>

        <BottomBar sx={{ pr: reservedRight }}>
          {/* Mic + share quick actions (keep compact on mobile) */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 1 }}>
            <Tooltip
              title={
                isSharingScreen
                  ? "Stop screen share"
                  : screenSharerId && screenSharerId !== currentUserId
                  ? `${screenSharerName || "Someone"} is already sharing`
                  : "Start screen share"
              }
            >
              <span>
                <IconButton
                  onClick={toggleScreenShare}
                  color={isSharingScreen ? "error" : "primary"}
                  size="small"
                  disabled={!isSharingScreen && !!screenSharerId && screenSharerId !== currentUserId}
                >
                  {isSharingScreen ? (
                    <StopScreenShareIcon fontSize="small" />
                  ) : (
                    <ScreenShareIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: "none", sm: "block" } }} />
          </Stack>

          <MembersScroll sx={{ flex: 1 }}>
            {displayMembers.map((p) => {
              const isCurrent = p.id === currentUserId;
              const displayName = p.name ?? p.id;
              const showMicOn = isCurrent ? micOn : p.muted === undefined ? true : !p.muted;
              return (
                <MemberItem key={p.id}>
                  <Avatar
                    sx={{
                      width: { xs: 40, sm: 48, md: 56 },
                      height: { xs: 40, sm: 48, md: 56 },
                      bgcolor: deterministicColor(displayName),
                      fontSize: { xs: 12, sm: 14, md: 16 },
                    }}
                  >
                    {avatarInitials(displayName)}
                  </Avatar>
                  <Typography
                    sx={{
                      fontSize: { xs: 10, sm: 11, md: 12 },
                      mt: 0.25,
                      textAlign: "center",
                      maxWidth: { xs: 56, md: 70 },
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={displayName}
                  >
                    {displayName}
                  </Typography>
                  <Tooltip
                    title={
                      isCurrent ? (showMicOn ? "Mute" : "Unmute") : showMicOn ? "Mic on" : "Mic off"
                    }
                  >
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (!isCurrent) return;
                        toggleMic();
                      }}
                      sx={{
                        bgcolor: showMicOn ? "rgba(25,118,210,0.12)" : undefined,
                        color: showMicOn ? "primary.main" : "text.secondary",
                      }}
                    >
                      {showMicOn ? <MicIcon fontSize="inherit" /> : <MicOffIcon fontSize="inherit" />}
                    </IconButton>
                  </Tooltip>
                </MemberItem>
              );
            })}
          </MembersScroll>
        </BottomBar>

        {/* Chat as side panel (md+) or slide-over (mobile) */}
        {chatOpen && (
          <ChatPanel
            onClose={() => {
              setChatOpen(false);
            }}
            messages={messages}
            onSend={(t) => {
              sendChat(t);
              setUnread(0);
            }}
            onTyping={setTyping}
            nameMap={nameMap}
            selfId={currentUserId}
            // make panel responsive without overlapping content on md+
            panelWidth={CHAT_WIDTH}
            mobileFullScreen
          />
        )}
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
