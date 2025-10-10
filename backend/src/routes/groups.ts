// backend/src/routes/groups.ts
import { Router } from 'express'
import { createGroup, listGroups, joinGroup, leaveGroup } from '../controllers/groups'
import { requireAuth } from '../middleware/auth'

const router = Router()

// list public groups (no auth)
router.get('/', listGroups)

// create group (auth) - user must not be member or owner already
router.post('/', requireAuth(), createGroup)

// join group (auth)
router.post('/:id/join', requireAuth(), joinGroup)

// leave group (auth)
router.post('/:id/leave', requireAuth(), leaveGroup)

export default router
