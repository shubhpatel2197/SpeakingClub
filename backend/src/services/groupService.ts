import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { io } from "../index";
import { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function removeUserFromGroup(userId: string, groupId: string) {
  // fetch once
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { ok: true }; // nothing to do, already gone

  // if (group.ownerId === userId) {
  //   const { ok } = await deleteGroupById(groupId, userId);
  //   if (ok) io.to("groups").emit("groups:remove", { id:groupId });
  //   return { ok: true };
  // }

  // non-owner path
  const membership = await prisma.membership.findUnique({ where: { userId } });

  if (!membership) {
    console.log("No membership found for user", userId, "in group", groupId);
    return { ok: true };
  }

  console.log(
    "Removing membership",
    membership.id,
    "for user",
    userId,
    "from group",
    groupId
  );
  await prisma.membership.delete({ where: { id: membership.id } });

  io.to("groups").emit("groups:memberLeft", { groupId, userId });
  return { ok: true };
}

export async function deleteGroupById(groupId: string, userId: string) {
  const res = await prisma.group.deleteMany({
    where: { id: groupId, ownerId: userId },
  });

  // res.count === 1 -> we actually deleted it now
  // res.count === 0 -> it was already gone, or user wasn’t the owner

  return {
    ok: res.count === 1,
    message: res.count ? "Group deleted" : "Group not found or not owner",
  };
}

export async function joinGroupCore(
  prisma: PrismaLike,
  params: { userId: string; groupId: string; name?: string }
) {
  const { userId, groupId, name } = params;

  console.log("joinGroupCore", { userId, groupId });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { memberships: true },
  });

  if (!group) {
    const err = new Error("Group not found");
    (err as any).status = 404;
    throw err;
  }

  const isOwnerOfThis = group.ownerId === userId;

  // Check existing membership
  const existing = await prisma.membership.findUnique({ where: { userId } });

  if (existing && existing.groupId === groupId) {
    // Already a member of this group — no-op, just emit event and return
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatar: true },
    });
    const member = {
      id: userId,
      name: userRecord?.name || name || "User",
      email: userRecord?.email,
      avatar: userRecord?.avatar || null,
      role: existing.role,
    };
    const groupsRoom = io.sockets.adapter.rooms.get("groups");
    console.log("[joinGroupCore] already member, emitting to", groupsRoom?.size ?? 0, "sockets");
    io.to("groups").emit("groups:memberJoined", { groupId, member });

    const updated = await prisma.group.findUnique({
      where: { id: groupId },
      include: { memberships: true },
    });
    return { membership: existing, group: updated };
  }

  if (existing) {
    // Member of a different group — block
    const err = new Error("You are already a member of another group");
    (err as any).status = 403;
    throw err;
  }

  // Capacity check
  if (!isOwnerOfThis && group.max_members && group.memberships.length >= group.max_members) {
    const err = new Error("Group is full");
    (err as any).status = 403;
    throw err;
  }

  const role = isOwnerOfThis ? "owner" : "member";

  const membership = await prisma.membership.create({
    data: {
      name: name || "User",
      role,
      user: { connect: { id: userId } },
      group: { connect: { id: groupId } },
    },
  });

  // Fetch user avatar for the socket event
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, avatar: true },
  });

  const member = {
    id: userId,
    name: userRecord?.name || name || "User",
    email: userRecord?.email,
    avatar: userRecord?.avatar || null,
    role,
  };
  const groupsRoom = io.sockets.adapter.rooms.get("groups");
  console.log("[joinGroupCore] emitting groups:memberJoined to", groupsRoom?.size ?? 0, "sockets in 'groups' room");
  io.to("groups").emit("groups:memberJoined", { groupId, member });

  const updated = await prisma.group.findUnique({
    where: { id: groupId },
    include: { memberships: true },
  });

  return { membership, group: updated };
}
