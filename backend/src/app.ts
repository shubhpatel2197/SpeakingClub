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
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://192.168.1.4:5173',  
    ],
    credentials: true,
  })
);

app.use(express.json())
app.use(cookieParser())

// public routes
app.use('/api/auth', authRoutes)

// protected routes
app.use('/api/user', requireAuth(), userRoutes)
app.use('/api/groups', groupRoutes)

app.get('/health', (_req, res) => res.json({ ok: true }))


export default app
