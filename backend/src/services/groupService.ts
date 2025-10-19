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
  if (!membership || membership.groupId !== groupId) {
    throw new Error("Membership not found for this group");
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

  // Is the user an owner of ANY group?
  const ownsAny = await prisma.group.findFirst({ where: { ownerId: userId } });

  if (!isOwnerOfThis && ownsAny) {
    const err = new Error("Cannot join a group while owning another group");
    (err as any).status = 403;
    throw err;
  }

  // Existing membership?
  const existingMembership = await prisma.membership.findUnique({
    where: { userId },
  });

  console.log("Existing membership:", existingMembership);

  if (existingMembership) {
    if (existingMembership.groupId !== groupId) {
      const err = new Error("Already a member of another group");
      (err as any).status = 409;
      throw err;
    } else {
      const err = new Error("Already a member of group");
      (err as any).status = 409;
      throw err;
    }
  }

  // Capacity (owners can always join their own group)
  if (!isOwnerOfThis) {
    if (group.max_members && group.memberships.length >= group.max_members) {
      const err = new Error("Group is full");
      (err as any).status = 403;
      throw err;
    }
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

  const updated = await prisma.group.findUnique({
    where: { id: groupId },
    include: { memberships: true },
  });

  io.to("groups").emit("groups:upsert", { group: updated });
  return { membership, group: updated };
}
