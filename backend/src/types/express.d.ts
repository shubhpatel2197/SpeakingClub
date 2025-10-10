// backend/src/types/express.d.ts
import type { User } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: Partial<User> | null
      tokenPayload?: { userId: string; iat?: number; exp?: number } | null
    }
  }
}
