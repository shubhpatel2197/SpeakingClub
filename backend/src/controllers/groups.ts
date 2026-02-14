// backend/src/controllers/groups.ts
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  removeUserFromGroup,
  joinGroupCore,
  deleteGroupById,
} from "../services/groupService";
import { io } from "../index";

/**
 * Create a group.
 * Rules enforced:
 * - user must be authenticated
 * - user must NOT already own a group
 * - user must NOT already be a member of another group
 */

export async function createGroup(req: Request, res: Response) {
  console.log("Create group called");
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { description, language, level, max_members, name } = req.body;

  // still enforce: cannot create if already member or already own one
  const existingMembership = await prisma.membership.findUnique({
    where: { userId },
  });
  if (existingMembership) {
    return res
      .status(403)
      .json({ error: "Cannot create a group while a member of another group" });
  }
  const existingOwn = await prisma.group.findUnique({
    where: { ownerId: userId },
  });
  if (existingOwn)
    return res.status(403).json({ error: "You already own a group" });

  try {
    const group = await prisma.group.create({
      data: {
        description,
        language,
        level,
        max_members,
        owner: { connect: { id: userId } },
      },
      include: { memberships: true },
    });
    // emit once more if you want, but joinGroupCore already emitted upsert
    // io.to('groups').emit('groups:upsert', { group: result })

    return res.status(201).json({ group: group });
  } catch (err: any) {
    console.error(err);
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({ error: "Unique constraint failed" });
    }
    if (err.status) return res.status(err.status).json({ error: err.message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * List public groups with optional filters
 */
export async function listGroups(req: Request, res: Response) {
  console.log("Listing")
  const { language, level, take = 20, cursor } = req.query;
  const where: any = { is_public: true };
  if (language) where.language = String(language);
  if (level) where.level = String(level);

  const groups = await prisma.group.findMany({
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  res.json({ groups });
}

/**
 * Join a group (current user)
 * Checks:
 * - user must not own a group
 * - user must not already be a member
 * - group must exist and not exceed max_members (if set)
 */
export async function joinGroup(req: Request, res: Response) {
  console.log("Join group called", req.params.id);
  const userId = req.user?.id;
  const groupId = req.params.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { membership } = await joinGroupCore(prisma, {
      userId,
      groupId,
      name: req.user?.name || "User",
    });
    return res.json({ membership });
  } catch (err: any) {
    console.error(err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({ error: "Already a member" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Leave a group
 */
export async function leaveGroup(req: Request, res: Response) {
  const userId = req.user?.id;
  const groupId = req.params.roomId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  removeUserFromGroup(userId, groupId)
    .then(() => {
      return res.json({ ok: true });
    })
    .catch((error: any) => {
      console.error(error);
      if (error.message === "Group not found") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    });
}

export async function deleteGroup(req: Request, res: Response) {
  const userId = req.user?.id;
  const groupId = req.params.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await deleteGroupById(groupId, userId);
    io.to("groups").emit("groups:remove", { id: groupId });
    return res.json({ ok: true });
  } catch (error: any) {
    
    if (error.message === "Group not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Only the owner")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}



