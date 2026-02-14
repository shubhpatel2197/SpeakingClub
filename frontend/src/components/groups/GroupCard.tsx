import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Trash2, User } from "lucide-react";
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

const MAX_VISIBLE = 12;

function baseAvatarSize(count: number) {
  if (count <= 2) return 80;
  if (count <= 3) return 68;
  if (count <= 4) return 60;
  if (count <= 6) return 52;
  if (count <= 8) return 46;
  return 40;
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
      const roomUrl = `/room/${group.id}`;
      window.open(roomUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
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
      showSnackbar(err?.response?.data?.error || "Failed to delete group", {
        severity: "error",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const displayCount = Math.min(members.length, MAX_VISIBLE);
  const avatarSize = baseAvatarSize(displayCount);

  const placeholders =
    typeof group.max_members === "number"
      ? Math.max(0, Math.min(group.max_members, MAX_VISIBLE) - displayCount)
      : Math.max(0, 2 - displayCount);

  return (
    <div className="relative glass rounded-2xl p-5 transition-all duration-300 hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.1)] group/card">
      {/* Delete button (owner only) */}
      {isOwner && (
        <button
          onClick={() => setDeleteOpen(true)}
          className="absolute left-3 bottom-3 z-10 p-1.5 rounded-full glass hover:bg-destructive/20 hover:text-destructive transition-all duration-200 text-foreground/50"
          aria-label="Delete group"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base text-foreground truncate">
            {group.language} <span className="text-primary/60">•</span> {group.level}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {group.description || "No description"}
          </p>
        </div>

        <div className="text-right shrink-0">
          {group.owner && (
            <Badge variant="outline" className="text-xs">
              {group.owner.name ?? "Owner"}
            </Badge>
          )}
          <p className="text-xs text-muted-foreground mt-1.5">
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Avatars */}
      <div className="flex flex-wrap gap-2 mb-4">
        {members.slice(0, MAX_VISIBLE).map((m) => (
          <MemberAvatar
            key={m.id}
            member={m}
            avatarSize={avatarSize}
            withName={false}
          />
        ))}

        {Array.from({ length: placeholders }).map((_, i) => (
          <div
            key={`ph-${i}`}
            className="rounded-full border-2 border-dashed border-border flex items-center justify-center text-foreground/20"
            style={{ width: avatarSize, height: avatarSize }}
          >
            <User className="w-5 h-5" />
          </div>
        ))}

        {memberCount > MAX_VISIBLE && (
          <div
            className="rounded-full bg-secondary flex items-center justify-center font-semibold text-sm text-foreground/60"
            style={{ width: avatarSize, height: avatarSize }}
          >
            +{memberCount - MAX_VISIBLE}
          </div>
        )}
      </div>

      {/* Footer */}
      {!hideJoin && (
        <div className="flex justify-end">
          <Button
            onClick={handleJoin}
            disabled={joinLoading}
            size="sm"
            className="px-6"
          >
            {joinLoading ? "Joining..." : "Join"}
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !deleteLoading && setDeleteOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this group?</DialogTitle>
            <DialogDescription>
              This action can't be undone. All members will lose access to this room.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
