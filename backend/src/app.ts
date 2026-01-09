// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth'
import userRoutes from './routes/user' 
import { requireAuth } from './middleware/auth'
import groupRoutes from './routes/groups'
import  opentelemetry  from '@opentelemetry/api'

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

app.use((req, res, next) => {
  const sessionID = "shubh";
  console.log("sessionID", sessionID);
  if (sessionID) {
    // 1. Get the current active Span (the one OTel just started)
    const currentSpan = opentelemetry.trace.getSpan(opentelemetry.context.active());

    if (currentSpan) {
      // 2. Add your custom tag (This is what makes it searchable!)
      currentSpan.setAttribute('bug.session_id', sessionID);
      
      // Optional: Add more context if useful
      currentSpan.setAttribute('bug.reporter_ip', req.ip);
    }
  }
  next();
});

// public routes
app.use('/auth', authRoutes)


// protected routes
app.use('/user', requireAuth(), userRoutes)
app.use('/groups', groupRoutes)

app.get('/health', (_req, res) => res.json({ ok: true }))


export default app
