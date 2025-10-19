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
import VideoArea from "../components/room/VideoArea";
import { useAuthContext } from "../context/AuthProvider";
import { useMediasoup } from "../hooks/useMediasoup";
import { useNavigate, useParams } from "react-router-dom";
import { useCurrentGroup } from "../context/CurrentGroupContext";
import { useSnackbar } from "../context/SnackbarProvider";

const RoomContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "85vh",
  width: "100%",
  background:
    theme.palette.mode === "dark"
      ? "linear-gradient(180deg, #121212 0%, #1e1e1e 100%)"
      : "linear-gradient(180deg, #f7f9fc 0%, #ffffff 100%)",
}));

const TopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1.5, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backdropFilter: "blur(6px)",
}));

const MainArea = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  position: "relative",
}));

const BottomBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(1),
  borderTop: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  position: "relative",
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
  const {showSnackbar} = useSnackbar();
  const navigate = useNavigate();
  const { id: roomId } = useParams<{ id: string }>();
  const { user } = useAuthContext();
  const { joinRoom, leaveRoom, toggleMic, micOn, participants: rtcParticipants } =
    useMediasoup();
  const group = useCurrentGroup();

  console.log("Room component render, group:", group);

  // const backendMembers: RoomParticipant[] = useMemo(() => {
  //   if (!group) return [];
  //   if (Array.isArray(group.memberships) && group.memberships.length > 0) {
  //     return group.memberships.map((m: any) => {
  //       if (m?.user) return { id: m.user.id, name: m.user.name ?? m.user.email };
  //       if (m?.id && (m?.name || m?.email)) return { id: m.id, name: m.name ?? m.email };
  //       return { id: m?.id ?? String(m), name: m?.name ?? m?.email ?? String(m) };
  //     });
  //   }
  //   return [];
  // }, [group, rtcParticipants]);

  const membersCount = useMemo(() => {
    console.log("membersCount calc for group:", group);
    if (!group) return 0;
    if (typeof group._count === "object" && typeof group._count.memberships === "number") {
      return group._count.memberships;
    }
    if (Array.isArray(group.memberships)) return group.memberships.length;
    if(rtcParticipants){
      return rtcParticipants.length;
    }
    return 0;
  }, [group, rtcParticipants]);

  const [displayMembers, setDisplayMembers] = useState<RoomParticipant[]>([]);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  const isOwner = !!(user?.id && group?.owner && user.id === group.owner.id);

  useEffect(() => {
    const map = new Map<string, RoomParticipant>();
    // backendMembers.forEach((m) => map.set(m.id, { ...m }));
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
    console.log("use effect joining room", group);
    const membersList = group?.memberships || [];
    const isMember = membersList.some((m: any) => {
      const mid =
        // common shapes your code uses
        (m as any).user?.id ?? (m as any).userId ?? (m as any).id;
      return mid && mid === user?.id;
    });
    if (isMember) {
      navigate("/", { replace: true });
      // showSnackbar("You are already a member of group");
      return;
    }
    joinRoom(roomId);

    return () => {
      console.log("use effect cleanup leaving room", roomId);
    };
  }, [roomId, joinRoom]);

  const handleLeaveClick = async () => {
      setConfirmLeaveOpen(true);
  };

  const confirmLeave = async () => {
    leaveRoom();
    setConfirmLeaveOpen(false);
    navigate("/");
  };

  const cancelLeave = () => setConfirmLeaveOpen(false);

  const currentUserId = user?.id;

  return (
    <RoomContainer>
      {/* TopBar */}
      <TopBar>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            {group?.description ?? "Group room"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Language: {group?.language ?? "—"} • Level: {group?.level ?? "—"} • Members: {membersCount}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<LogoutIcon />}
          onClick={handleLeaveClick}
        >
          Leave
        </Button>
      </TopBar>

      {/* Main area: video + chat */}
      <MainArea>
        <VideoArea />
        <ChatPanel onClose={() => {}} />
        <div id="remote-audio-container" />
      </MainArea>

      {/* Bottom bar: controls and members */}
      <BottomBar>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
          <Tooltip title={micOn ? "Turn off microphone" : "Turn on microphone"}>
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
            const showMicOn = isCurrent ? micOn : p.muted === undefined ? true : !p.muted;
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
                      bgcolor: showMicOn ? "rgba(25,118,210,0.12)" : undefined,
                      color: showMicOn ? "primary.main" : "text.secondary",
                    }}
                  >
                    {showMicOn ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </MemberItem>
            );
          })}
        </MembersScroll>

        <Box sx={{ ml: 2 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              navigator.clipboard
                ?.writeText(window.location.href)
                .then(() => alert("Invite link copied"))
                .catch(() => alert("Could not copy link"));
            }}
          >
            Invite
          </Button>
        </Box>
      </BottomBar>

      {/* Owner leave confirmation backdrop */}
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
            <Button onClick={confirmLeave} color="error" variant="contained" startIcon={<LogoutIcon />}>
              Leave
            </Button>
          </Stack>
        </Paper>
      </Backdrop>
    </RoomContainer>
  );
}
