'use client'

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
import { useGroups } from "../../context/GroupContext";
import { useRouter } from "next/navigation";
import axiosInstance from "../../api/axiosInstance";
import { openLoadingTab } from "../../lib/openLoadingTab";

export type Member = {
  id: string;
  name?: string | null;
  email?: string;
  avatar?: string | null;
  role?: string;
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

const MAX_SLOTS = 6;

function avatarSize(total: number) {
  if (total <= 3) return 64;
  return 52;
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
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const { optimisticJoin, optimisticLeave } = useGroups();
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
    optimisticJoin(group.id);
    const newTab = openLoadingTab("Joining room...");
    try {
      await axiosInstance.post(`/api/groups/${group.id}/join`, { withCredentials: true });
      if (newTab) newTab.location.href = `/room/${group.id}`;
      else router.push(`/room/${group.id}`);
    } catch (err: any) {
      // 409 = already a member, still open the room
      if (err?.response?.status === 409) {
        if (newTab) newTab.location.href = `/room/${group.id}`;
        else router.push(`/room/${group.id}`);
      } else {
        if (newTab) newTab.close();
        optimisticLeave(group.id);
        showSnackbar(err?.response?.data?.error || "Failed to join group", {
          severity: "error",
        });
      }
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

  const handleLeave = async () => {
    if (!user) return;
    optimisticLeave(group.id);
    try {
      await axiosInstance.post(`/api/groups/${group.id}/leave`, { withCredentials: true });
      // Signal the room tab to disconnect and navigate away
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel(`room:${group.id}`);
        ch.postMessage({ type: "leave" });
        ch.close();
      }
      onLeaveSuccess?.(group.id);
    } catch (err: any) {
      optimisticJoin(group.id);
      showSnackbar(err?.response?.data?.error || "Failed to leave group", {
        severity: "error",
      });
    }
  };

  const maxSlots = Math.min(group.max_members ?? MAX_SLOTS, MAX_SLOTS);
  const visibleMembers = members.slice(0, maxSlots);
  const placeholderCount = Math.max(0, maxSlots - visibleMembers.length);
  const totalSlots = visibleMembers.length + placeholderCount;
  const size = avatarSize(totalSlots);

  return (
    <div className="relative bg-card border border-border rounded-2xl p-5 transition-all duration-200 hover:border-primary/20 group/card">
      {isOwner && (
        <button
          onClick={() => setDeleteOpen(true)}
          className="absolute left-3 bottom-3 z-10 p-1.5 rounded-full bg-secondary hover:bg-destructive/20 hover:text-destructive transition-all duration-200 text-foreground/50"
          aria-label="Delete group"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      <div className="flex justify-between items-start gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-base text-foreground truncate">
            {group.language} <span className="text-primary/60">&middot;</span> {group.level}
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

      <div className="grid grid-cols-3 gap-2 mb-4" style={{ justifyItems: "center" }}>
        {visibleMembers.map((m) => (
          <MemberAvatar
            key={m.id}
            member={m}
            avatarSize={size}
            withName={false}
          />
        ))}

        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div
            key={`ph-${i}`}
            className="rounded-full border-2 border-dashed border-border flex items-center justify-center text-foreground/20"
            style={{ width: size, height: size }}
          >
            <User className="w-5 h-5" />
          </div>
        ))}
      </div>

      {!hideJoin && (
        <div className="flex justify-end">
          {isAlreadyMember ? (
            <Button
              onClick={handleLeave}
              variant="outline"
              size="sm"
              className="px-6 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              Leave
            </Button>
          ) : (
            <Button
              onClick={handleJoin}
              disabled={joinLoading}
              size="sm"
              className="px-6"
            >
              {joinLoading ? "Joining..." : "Join"}
            </Button>
          )}
        </div>
      )}

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
