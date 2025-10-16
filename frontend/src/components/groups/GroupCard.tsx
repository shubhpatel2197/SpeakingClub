import React, { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Stack,
  Chip,
  Avatar,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import axiosInstance from "../../api/axiosInstance";
import { useAuthContext } from "../../context/AuthProvider";
import MemberAvatar from "../ui/MemberAvatar";
import { useSnackbar } from "../../context/SnackbarProvider";
import { useNavigate } from "react-router-dom";
import { useMediasoup } from "../../hooks/useMediasoup";

export type Member = {
  id: string;
  name?: string | null;
  email?: string;
};

export type Group = {
  id: string;
  description?: string | null;
  language: string;
  level: string;
  max_members?: number | null;
  owner?: { id: string; name?: string | null; email?: string | null };
  memberships?: Member[];
  _count?: { memberships?: number };
};

const StyledCard = styled(Card)(({ theme }) => ({
  minWidth: 430,
  minHeight: 270,
  borderRadius: theme.spacing(1.5),
  padding: theme.spacing(1),
  boxShadow:
    "hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px",
}));

const MemberBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
}));

export default function GroupCard({
  group,
  onJoinSuccess,
  hideJoin,
}: {
  group: Group;
  onJoinSuccess?: (groupId: string) => void;
  onLeaveSuccess?: (groupId: string) => void;
  hideJoin?: boolean;
}) {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);

  const members = group.memberships ?? [];
  const memberCount = group._count?.memberships ?? members.length;

  const isOwner = !!(group.owner && user && group.owner.id === user.id);
  const isAlreadyMember = !!members.find((m) => m.id === user?.id);
  const isFull =
    typeof group.max_members === "number" && memberCount >= group.max_members;

  const handleJoin = async () => {
    if (!user)
      return showSnackbar("Please sign in to join a group", {
        severity: "info",
      });
    if (isOwner)
      return showSnackbar("You are the owner of this group", {
        severity: "info",
      });
    if (isAlreadyMember)
      return showSnackbar("You are already a member of this group", {
        severity: "info",
      });
    if (isFull) return showSnackbar("This group is full", { severity: "info" });

    setLoading(true);
    try {
      await axiosInstance.post(`/groups/${group.id}/join`);

      showSnackbar("Joined group successfully!");
      onJoinSuccess?.(group.id);

      // open the room in a new tab
      const roomUrl = `/room/${group.id}`;

      window.open(roomUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error(err);
      showSnackbar(err?.response?.data?.error || "Failed to join group", {
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyledCard>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box>
            {/* language & level emphasized */}
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                display: "flex",
                ml: 1,
                mt: 0.5,
              }}
            >
              {group.language} • {group.level}
            </Typography>

            {/* smaller description text */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: "flex", ml: 1, fontSize: "0.85rem" }}
            >
              {group.description || "No description"}
            </Typography>
          </Box>

          <Box sx={{ textAlign: "right" }}>
            {group.owner && (
              <Chip
                label={`Owner: ${group.owner.name ?? group.owner.id}`}
                size="small"
                variant="outlined"
              />
            )}
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              {memberCount} member{memberCount === 1 ? "" : "s"}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={2} sx={{ mx: 4 }}>
          {members.slice(0, 2).map((m, i) => (
            <MemberAvatar
              sxAvatar={{
                mt: 3,
                width: 110,
                height: 110,
              }}
              key={m.id || i}
              member={m}
            />
          ))}
          {Array.from({
            length: Math.max(0, 2 - members.slice(0, 2).length),
          }).map((_, i) => (
            <MemberBox key={`empty-${i}`}>
              <Avatar
                sx={{
                  mt: 3,
                  width: 110,
                  height: 110,
                  bgcolor: "background.paper",
                  border: "2px dashed rgba(255,255,255,0.2)",
                }}
              />
            </MemberBox>
          ))}
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2, mr: 2 }}>
          {!hideJoin && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleJoin}
              sx={{ px: 4, borderRadius: 1 }}
            >
              Join
            </Button>
          )}
        </Box>
      </CardContent>
    </StyledCard>
  );
}
