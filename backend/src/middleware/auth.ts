// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { IncomingMessage } from 'http'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

// options: whether to load full user from DB or only attach payload
type AuthOptions = {
  requireUser?: boolean // if true, will fetch user from DB and 401 if not found
}

/**
 * requireAuth middleware
 * - reads token from cookie 'token' (HttpOnly)
 * - verifies JWT
 * - optionally loads user from DB and attaches to req.user
 */
export function requireAuth(options: AuthOptions = { requireUser: true }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("HI")
      const token =
        req.cookies?.token ||
        // fallback: Authorization header (Bearer)
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.split(' ')[1]
          : undefined)

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // verify token
      let payload: any
      try {
        payload = jwt.verify(token, JWT_SECRET)
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' })
      }

      // attach raw payload for downstream use
      req.tokenPayload = payload as { userId: string; iat?: number; exp?: number }

      if (options.requireUser) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, email: true, name: true, createdAt: true },
        })

        if (!user) {
          return res.status(401).json({ error: 'User not found' })
        }

        req.user = user
      } else {
        req.user = { id: payload.userId } as any
      }

      return next()
    } catch (err) {
      console.error('Auth middleware error', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export async function verifyTokenFromRequest(req: IncomingMessage) {
  try {
    // 1) Try reading token from cookie header manually
    const cookieHeader = req.headers.cookie || ''
    let token: string | undefined

    // Parse cookies manually
    const cookies: Record<string, string> = {}
    cookieHeader.split(';').forEach((pair) => {
      const [k, v] = pair.trim().split('=')
      if (k && v) cookies[k] = decodeURIComponent(v)
    })
    if (cookies.token) token = cookies.token

    // 2) Fallback: Authorization header (Bearer)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return null
    }

    // 3) Verify JWT
    let payload: any
    try {
      payload = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      console.warn('[verifyTokenFromRequest] invalid token', err)
      return null
    }

    // 4) Lookup user in DB
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return null
    }

    return user
  } catch (err) {
    console.error('[verifyTokenFromRequest] error', err)
    return null
  }
}
