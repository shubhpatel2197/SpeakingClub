import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

// GET /api/profile — get current user profile
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar: true, gender: true, interests: true, agreedToTerms: true, createdAt: true },
    })

    if (!user) return res.status(404).json({ error: 'User not found' })
    return res.json({ user })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/profile — update name and/or avatar
router.patch('/', async (req, res) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { name, avatar, gender } = req.body
    const data: Record<string, string> = {}

    if (typeof name === 'string') {
      const trimmed = name.trim()
      if (trimmed.length === 0) return res.status(400).json({ error: 'Name cannot be empty' })
      if (trimmed.length > 50) return res.status(400).json({ error: 'Name too long (max 50 chars)' })
      data.name = trimmed
    }

    if (typeof avatar === 'string') {
      data.avatar = avatar
    }

    if (gender === 'MALE' || gender === 'FEMALE') {
      data.gender = gender
    }

    // Handle interests (string array, max 6)
    let interestsUpdate: string[] | undefined
    if (Array.isArray(req.body.interests)) {
      interestsUpdate = req.body.interests
        .filter((i: any) => typeof i === 'string' && i.trim().length > 0)
        .map((i: string) => i.trim())
        .slice(0, 6)
    }

    // Handle agreedToTerms
    let agreedUpdate: boolean | undefined
    if (typeof req.body.agreedToTerms === 'boolean') {
      agreedUpdate = req.body.agreedToTerms
    }

    if (Object.keys(data).length === 0 && interestsUpdate === undefined && agreedUpdate === undefined) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        ...(interestsUpdate !== undefined && { interests: interestsUpdate }),
        ...(agreedUpdate !== undefined && { agreedToTerms: agreedUpdate }),
      },
      select: { id: true, email: true, name: true, avatar: true, gender: true, interests: true, agreedToTerms: true, createdAt: true },
    })

    return res.json({ user })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
