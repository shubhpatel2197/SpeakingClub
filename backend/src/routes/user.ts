// backend/src/routes/user.ts
import { Router } from 'express'

const router = Router()

// GET /api/user/me
router.get('/me', (req, res) => {
  // req.user was attached by requireAuth
  console.log('req.user', req.user)
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  return res.json({ user: req.user })
})

export default router
