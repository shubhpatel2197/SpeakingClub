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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
} from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import PersonIcon from "@mui/icons-material/Person";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import MemberAvatar from "../ui/MemberAvatar";
import { useAuthContext } from "../../context/AuthProvider";
import { useSnackbar } from "../../context/SnackbarProvider";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";

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

// ⬇️ Responsive card: full-width on mobile, original size on sm+
const StyledCard = styled(Card)(({ theme }) => ({
  position: "relative",
  borderRadius: theme.spacing(1.5),
  boxShadow:
    "hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px",
  // desktop/tablet defaults
  minWidth: 430,
  minHeight: 270,
  padding: theme.spacing(1.25),
  // mobile overrides
  [theme.breakpoints.down("sm")]: {
    minWidth: "100%",
    minHeight: 220,
    padding: theme.spacing(1),
  },
}));

const MAX_VISIBLE = 12;

// Base avatar sizing logic (desktop/tablet)
function baseAvatarSize(count: number) {
  if (count <= 2) return 110;
  if (count <= 3) return 92;
  if (count <= 4) return 80;
  if (count <= 6) return 68;
  if (count <= 8) return 58;
  return 48;
}

export default function GroupCard({
  group,
  onJoinSuccess,
  onLeaveSuccess,
  onDeleteSuccess,
  hideJoin,
}: {
  group: Group;
  onJoinSuccess?: (groupId: string) => void;
  onLeaveSuccess?: (groupId: string) => void;
  onDeleteSuccess?: (groupId: string) => void;
  hideJoin?: boolean;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const [joinLoading, setJoinLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const members = group.memberships ?? [];
  const memberCount = group._count?.memberships ?? members.length;

  const isOwner = !!(group.owner && user && group.owner.id === user.id);
  const isAlreadyMember = !!members.find((m) => m.id === user?.id);
  const isFull =
    typeof group.max_members === "number" && memberCount >= group.max_members;

  const handleJoin = async () => {
    if (!user)
      return showSnackbar("Please sign in to join a group", { severity: "info" });
    if (isAlreadyMember)
      return showSnackbar("You are already a member of this group", { severity: "info" });
    if (isFull) return showSnackbar("This group is full", { severity: "info" });

    setJoinLoading(true);
    try {
      // Open room directly for now
      const roomUrl = `/room/${group.id}`;
      window.open(roomUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error(err);
      showSnackbar(err?.response?.data?.error || "Failed to join group", {
        severity: "error",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await axiosInstance.post(`/api/groups/${group.id}/delete`, {
        userId: user?.id,
        withCredentials: true,
      });
      showSnackbar("Group deleted", { severity: "success" });
      onDeleteSuccess?.(group.id);
      setDeleteOpen(false);
    } catch (err: any) {
      console.error(err);
      showSnackbar(err?.response?.data?.error || "Failed to delete group", {
        severity: "error",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const displayCount = Math.min(members.length, MAX_VISIBLE);

  // Scale avatars down on mobile (≈ 70% looks good)
  const avatarSize = Math.round(
    baseAvatarSize(displayCount) * (isMobile ? 0.7 : 1)
  );

  const placeholders =
    typeof group.max_members === "number"
      ? Math.max(0, Math.min(group.max_members, MAX_VISIBLE) - displayCount)
      : Math.max(0, 2 - displayCount);

  return (
    <StyledCard>
      {isOwner && (
        <IconButton
          size="small"
          aria-label="Delete group"
          onClick={() => setDeleteOpen(true)}
          sx={(t) => ({
            position: "absolute",
            left: t.spacing(1),
            bottom: t.spacing(1),
            zIndex: 2,
            bgcolor: t.palette.mode === "dark" ? "grey.900" : "common.white",
            border: `1px solid ${t.palette.divider}`,
            boxShadow: 1,
            "&:hover": { bgcolor: t.palette.error.light, color: "#fff" },
          })}
        >
          <DeleteForeverOutlinedIcon fontSize="small" />
        </IconButton>
      )}

      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: { xs: 1.25, sm: 2 },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "flex-start" },
            gap: { xs: 1, sm: 0 },
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                ml: 1,
                mt: 0.5,
                fontSize: { xs: "0.95rem", sm: "1rem" },
              }}
            >
              {group.language} • {group.level}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                ml: 1,
                fontSize: { xs: "0.8rem", sm: "0.85rem" },
              }}
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
            <Typography
              variant="caption"
              display="block"
              sx={{ mt: 1, fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
            >
              {memberCount} member{memberCount === 1 ? "" : "s"}
            </Typography>
          </Box>
        </Box>

        {/* Avatars */}
        <Stack
          direction="row"
          useFlexGap
          flexWrap="wrap"
          gap={{ xs: 1, sm: 1.5 }}
          sx={{ mx: { xs: 1, sm: 2 }, mt: { xs: 0.5, sm: 1 } }}
        >
          {members.slice(0, MAX_VISIBLE).map((m) => (
            <MemberAvatar
              key={m.id}
              member={m}
              sxAvatar={{
                mt: 1,
                width: avatarSize,
                height: avatarSize,
              }}
            />
          ))}

          {Array.from({ length: placeholders }).map((_, i) => (
            <Avatar
              key={`ph-${i}`}
              sx={(t) => ({
                mt: 1,
                width: avatarSize,
                height: avatarSize,
                bgcolor:
                  t.palette.mode === "dark"
                    ? t.palette.background.default
                    : t.palette.action.hover,
                border: `2px dashed ${t.palette.divider}`,
                color: t.palette.text.disabled,
              })}
            >
              <PersonIcon
                sx={{ fontSize: Math.max(18, Math.floor(avatarSize / 2.5)) }}
              />
            </Avatar>
          ))}

          {memberCount > MAX_VISIBLE && (
            <Chip
              label={`+${memberCount - MAX_VISIBLE}`}
              size="small"
              sx={{
                height: avatarSize,
                borderRadius: avatarSize / 2,
                alignSelf: "center",
                fontWeight: 600,
              }}
            />
          )}
        </Stack>

        {/* Footer */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            mb: { xs: 1, sm: 2 },
            mr: { xs: 1, sm: 2 },
          }}
        >
          {!hideJoin && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleJoin}
              disabled={joinLoading}
              sx={{
                px: { xs: 3, sm: 4 },
                py: { xs: 0.5, sm: 0.75 },
                borderRadius: 1,
                fontSize: { xs: "0.85rem", sm: "0.9rem" },
              }}
            >
              {joinLoading ? "Joining..." : "Join"}
            </Button>
          )}
        </Box>
      </CardContent>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => (deleteLoading ? null : setDeleteOpen(false))}
      >
        <DialogTitle>Delete this group?</DialogTitle>
        <DialogContent>
          This action can’t be undone. All members will lose access to this room.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </StyledCard>
  );
}
