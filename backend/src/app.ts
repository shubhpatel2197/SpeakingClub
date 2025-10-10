// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth'
import userRoutes from './routes/user' 
import { requireAuth } from './middleware/auth'
import groupRoutes from './routes/groups'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
)

app.use(express.json())
app.use(cookieParser())

// public routes
app.use('/api/auth', authRoutes)

// protect routes under /api (example)
// if you want all /api/* to require auth, uncomment below:
// app.use('/api', requireAuth(), apiRoutes)

// or selectively protect a router:
app.use('/api/user', requireAuth(), userRoutes)
app.use('/api/groups', groupRoutes)

app.get('/health', (_, res) => res.json({ ok: true }))

export default app
