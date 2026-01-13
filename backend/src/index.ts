// backend/src/index.ts

import http from 'http'
import app from './app'
import { Server as IOServer } from 'socket.io'
import { attachSocketServer } from './socketHandlers'

const PORT = Number(process.env.PORT || 4000)
const HOST = '0.0.0.0'

const server = http.createServer(app)

export const io = new IOServer(server, {
    path: '/socket.io',
    pingInterval: 25000, 
    pingTimeout: 30000,
    cors: {
      origin(_o, cb) {
        cb(null, true)
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowRequest: (req, cb) => cb(null, true),
  })

attachSocketServer(io)

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
