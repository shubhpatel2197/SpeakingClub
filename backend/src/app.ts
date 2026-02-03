// backend/src/app.ts
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth'
import userRoutes from './routes/user' 
import { requireAuth } from './middleware/auth'
import groupRoutes from './routes/groups'
// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");



Sentry.init({
  dsn: "https://b0fd50628ffc3362da5e7cffd5beed73@o4510820456595456.ingest.us.sentry.io/4510820642324480",
  integrations: [
    nodeProfilingIntegration(),
  ],

  // Send structured logs to Sentry
  enableLogs: true,
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,
  // Trace lifecycle automatically enables profiling during active traces
  profileLifecycle: 'trace',
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});

// Profiling happens automatically after setting it up with `Sentry.init()`.
// All spans (unless those discarded by sampling) will have profiling data attached to them.
Sentry.startSpan({
  name: "My Span",
}, () => {
  // The code executed here will be profiled
});


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

app.get('/health', (_req, res) => res.json({ ok: true }))




export default app
