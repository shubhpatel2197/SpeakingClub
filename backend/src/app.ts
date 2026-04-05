// backend/src/app.ts
import * as Sentry from "@sentry/node";
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth'
import userRoutes from './routes/user'
import { requireAuth } from './middleware/auth'
import groupRoutes from './routes/groups'
import profileRoutes from './routes/profile'
import friendRoutes from './routes/friends'
import matchRoutes from './routes/matches'

const app = express()


app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://192.168.1.4:5173',
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
    ],
    credentials: true,
  })
);
;

app.use(express.json())
app.use(cookieParser())

Sentry.setupExpressErrorHandler(app);

app.use("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// public routes
app.use('/auth', authRoutes)


// protected routes
app.use('/user', requireAuth(), userRoutes)
app.use('/traces', userRoutes)
app.use('/groups', groupRoutes)
app.use('/profile', requireAuth(), profileRoutes)
app.use('/friends', requireAuth(), friendRoutes)
app.use('/matches', requireAuth(), matchRoutes)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.get('/test/error', (req, res) => {
  throw new Error('Backend Test Error: ' + new Date().toISOString());
});

app.get('/test/log', (req, res) => {
  console.log('Backend Info Log', 'info');
  console.log('Backend Warning Log', 'warning');
  console.log(new Error('Backend Captured Error Log'));
  res.json({ message: 'Logs triggered' });
});




export default app
