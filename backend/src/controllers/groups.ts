// backend/src/controllers/groups.ts
import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * Create a group.
 * Rules enforced:
 * - user must be authenticated
 * - user must NOT already own a group
 * - user must NOT already be a member of another group
 */

export async function createGroup(req: Request, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { description, language, level, max_members } = req.body

  // check if user is already member of a group
  const existingMembership = await prisma.membership.findUnique({
    where: { userId }
  })
  if (existingMembership) {
    return res.status(403).json({ error: 'Cannot create a group while a member of another group' })
  }

  // check if user already owns a group
  const existingOwn = await prisma.group.findUnique({
    where: { ownerId: userId }
  })
  if (existingOwn) {
    return res.status(403).json({ error: 'You already own a group' })
  }

  try {
    const group = await prisma.group.create({
      data: {
        description,
        language,
        level,
        max_members,
        owner: { connect: { id: userId } },
        memberships: {
          create: {
            user: { connect: { id: userId } },
            role: 'owner',
          }
        }
      },
      include: { memberships: true }
    })

    return res.status(201).json({ group })
  } catch (err: any) {
    console.error(err)
    // Catch unique constraint errors etc.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'Unique constraint failed' })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * List public groups with optional filters
 */
export async function listGroups(req: Request, res: Response) {
  const { language, level, take = 20, cursor } = req.query
  const where: any = { is_public: true }
  if (language) where.language = String(language)
  if (level) where.level = String(level)

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
})


  res.json({ groups })
}

/**
 * Join a group (current user)
 * Checks:
 * - user must not own a group
 * - user must not already be a member
 * - group must exist and not exceed max_members (if set)
 */
export async function joinGroup(req: Request, res: Response) {
  const userId = req.user?.id
  const groupId = req.params.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  // check ownership
  const own = await prisma.group.findUnique({ where: { ownerId: userId } })
  if (own) {
    return res.status(403).json({ error: 'Cannot join a group while owning one' })
  }

  // check existing membership
  const existingMembership = await prisma.membership.findUnique({ where: { userId } })
  if (existingMembership) {
    return res.status(409).json({ error: 'Already a member of a group' })
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { memberships: true } })
  if (!group) return res.status(404).json({ error: 'Group not found' })

  if (group.max_members && group.memberships.length >= group.max_members) {
    return res.status(403).json({ error: 'Group is full' })
  }

  try {
    const membership = await prisma.membership.create({
      data: {
        user: { connect: { id: userId } },
        group: { connect: { id: groupId } },
        role: 'member'
      }
    })
    return res.json({ membership })
  } catch (err: any) {
    console.error(err)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'Already a member' })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Leave a group
 */
export async function leaveGroup(req: Request, res: Response) {
  const userId = req.user?.id
  const groupId = req.params.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const membership = await prisma.membership.findUnique({ where: { userId } })
  if (!membership || membership.groupId !== groupId) {
    return res.status(404).json({ error: 'Membership not found for this group' })
  }

  // prevent owner from leaving (owner should delete group or transfer ownership)
  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (group?.ownerId === userId) {
    return res.status(403).json({ error: 'Owner cannot leave the group. Transfer ownership or delete group.' })
  }

  await prisma.membership.delete({ where: { id: membership.id } })
  return res.json({ ok: true })
}
