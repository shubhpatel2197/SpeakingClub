import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { io } from "../index";

export async function removeUserFromGroup(userId: string, groupId: string) {
  // fetch once
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { ok: true }; // nothing to do, already gone

  if (group.ownerId === userId) {
    const { ok } = await deleteGroupById(groupId, userId);
    if (ok) io.to("groups").emit("groups:remove", { id:groupId });
    return { ok: true };
  }

  // non-owner path
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership || membership.groupId !== groupId) {
    throw new Error("Membership not found for this group");
  }

  await prisma.membership.delete({ where: { id: membership.id } });

  const groupUpdated = await prisma.group.findUnique({
    where: { id: groupId },
    include: { memberships: true },
  });

  io.to("groups").emit("groups:upsert", { group: groupUpdated });
  return { ok: true };
}

export async function deleteGroupById(groupId: string, userId: string) {
  const res = await prisma.group.deleteMany({
    where: { id: groupId, ownerId: userId },
  });

  // res.count === 1 -> we actually deleted it now
  // res.count === 0 -> it was already gone, or user wasn’t the owner

  return { ok: res.count === 1, message: res.count ? "Group deleted" : "Group not found or not owner" };
}

