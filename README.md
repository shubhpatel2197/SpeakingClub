# Speaking Club

> A language learning and meeting new people platform built around live conversation.

Speaking Club helps people practice languages together through groups, direct connections, and spontaneous 1:1 chat. The app combines authentication, real-time messaging, audio/video rooms, screen sharing, and social features in a single full-stack workspace.

## Highlights

- Email/password and Google sign-in
- Public and private speaking groups
- Real-time chat, audio/video rooms, and screen sharing
- 1:1 random chat matching
- Friend requests and direct chats
- Profile setup for language practice and discovery

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI |
| Backend | Express, Socket.IO, TypeScript |
| Database | PostgreSQL + Prisma |
| Realtime media | mediasoup + mediasoup-client |
| Auth | JWT, cookies, Google OAuth |

## Monorepo structure

```text
.
├── backend/         Express API, Socket.IO server, Prisma, mediasoup
├── next-frontend/   Next.js app router frontend
├── shared/          Shared types/utilities package
├── old-frontend/    Older frontend kept in the repo
└── package.json     Workspace scripts
```

## Features

- Authentication with email/password and Google sign-in
- Group creation, discovery, joining, and membership management
- Group room messaging with live audio/video sessions
- In-room screen sharing during live sessions
- Random stranger chat with queue-based matching
- Friend requests, friend list, and direct room chat
- Profile updates including gender, interests, and terms agreement

## Prerequisites

- Node.js 20+
- `pnpm`
- PostgreSQL

You may also need TURN/STUN credentials for reliable media sessions outside localhost.

## Environment variables

### Backend

Create `backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_SECRET=replace-me
GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Optional but useful for WebRTC / mediasoup outside local dev
TURN_URIS=turn:your-turn-server:3478
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-password
ANNOUNCED_IP=your-public-ip
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
```

Notes:

- The Prisma client reads `DATABASE_URL`.
- The backend falls back to `4000` for `PORT`.
- Google login requires `GOOGLE_CLIENT_ID` on the backend.

### Frontend

Create `next-frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

## Quick Start

### 1. Install dependencies

From the repo root:

```bash
pnpm install
```

One thing to check first: `next-frontend/package.json` links `@betterbugs/web-sdk` from a local absolute path:

```text
link:/Users/shubh/bb-web-sdk/build
```

If that path does not exist on your machine, replace it with a published/package-local source before installing or running the frontend.

### 2. Set up the database

Generate the Prisma client:

```bash
pnpm --filter @app/backend run generate
```

Apply migrations:

```bash
pnpm --filter @app/backend exec prisma migrate deploy
```

For local development where you are still changing schema, `prisma migrate dev` may be more convenient.

### 3. Start the app

Start frontend and backend together from the repo root:

```bash
pnpm dev
```

That runs:

- frontend: `http://localhost:3000`
- backend: `http://localhost:4000`

Backend health check:

```bash
curl http://localhost:4000/health
```

## Workspace scripts

At the repo root:

```bash
pnpm dev
pnpm build
pnpm install:all
```

Backend:

```bash
pnpm --filter @app/backend run dev
pnpm --filter @app/backend run dev:mini
pnpm --filter @app/backend run build
pnpm --filter @app/backend run generate
```

Frontend:

```bash
pnpm --filter @app/next-frontend run dev
pnpm --filter @app/next-frontend run build
```

## Backend Overview

Main backend routes:

- `/auth` - signup, signin, Google auth, signout
- `/user` - authenticated user endpoints
- `/groups` - groups and memberships
- `/profile` - profile updates
- `/friends` - friend request flows
- `/matches` - match history
- `/health` - health check

Realtime transport:

- Socket.IO server is attached in `backend/src/index.ts`
- room and random-chat behavior is handled in `backend/src/socketHandlers.ts`
- random matching queue lives in `backend/src/randomChatQueue.ts`
- mediasoup room lifecycle lives under `backend/src/mediasoup/`

## Project Notes

- CORS currently allows `http://localhost:3000` and some local extension/dev origins.
- Auth uses both cookies and bearer tokens on the frontend.
- Prisma has special handling for Supabase pooler connection strings.
- The active frontend is `next-frontend/`. `old-frontend/` appears to be legacy code.

## Troubleshooting

If login works but realtime features fail:

- confirm `NEXT_PUBLIC_API_BASE_URL` points to the backend
- verify the browser can reach `http://localhost:4000/socket.io`
- check `JWT_SECRET` is set consistently for auth and sockets

If Prisma fails to connect:

- verify `DATABASE_URL`
- make sure PostgreSQL is running
- run `pnpm --filter @app/backend run generate` again after schema changes

If audio/video works only on localhost:

- set TURN variables
- set `ANNOUNCED_IP` when the server is behind NAT
- open the mediasoup UDP port range

## Suggested Next Improvements

- add a committed example env file for frontend and backend
- document the expected PostgreSQL provider/version
- remove or replace the machine-specific Betterbugs SDK link
- add test and deployment instructions
