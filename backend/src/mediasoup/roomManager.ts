// backend/src/mediasoup/roomManager.ts
import * as mediasoup from 'mediasoup'
import os from 'os'
import dotenv from 'dotenv'

dotenv.config()

const STUN_SERVER = { urls: 'stun:stun.l.google.com:19302' }

type RtcIceServer = { urls: string | string[]; username?: string; credential?: string }

function parseTurnServersFromEnv(): RtcIceServer[] {
  const uris = (process.env.TURN_URIS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (uris.length === 0) return [STUN_SERVER]
  const username = process.env.TURN_USERNAME || ''
  const credential = process.env.TURN_CREDENTIAL || ''
  return uris.map((u) => ({ urls: u, username, credential }))
}

/* ---------- registries exported for socket handlers ---------- */
export const rooms = new Map<string, Room>()
export const transportToRoom = new Map<string, string>() // transportId -> roomId

/**
 * Room class — manages Router, transports, producers, consumers for a single room.
 */
export class Room {
  public id: string
  public router: mediasoup.types.Router
  public transports: Map<string, mediasoup.types.WebRtcTransport> = new Map()
  public producers: Map<string, mediasoup.types.Producer> = new Map()
  public consumers: Map<string, mediasoup.types.Consumer> = new Map()

  constructor(id: string, router: mediasoup.types.Router) {
    this.id = id
    this.router = router
  }

  static async create(id: string) {
    const worker = await getMediasoupWorker()
    const router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        } as mediasoup.types.RtpCodecCapability,
      ],
    })
    return new Room(id, router)
  }

  getRouterRtpCapabilities(): mediasoup.types.RtpCapabilities {
    return this.router.rtpCapabilities
  }

  // create a WebRtcTransport, store it, and return the params client needs
  async createWebRtcTransport(): Promise<{
    id: string
    iceParameters: mediasoup.types.IceParameters
    iceCandidates: mediasoup.types.IceCandidate[]
    dtlsParameters: mediasoup.types.DtlsParameters
    iceServers: RtcIceServer[]
  }> {
    const webRtcTransportOptions: mediasoup.types.WebRtcTransportOptions = {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.ANNOUNCED_IP || undefined, // public IP if behind NAT
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1_000_000,
      appData: {},
    }

    const transport = await this.router.createWebRtcTransport(webRtcTransportOptions)
    this.transports.set(transport.id, transport)
    console.log('[ms] ICE candidates:', transport.iceCandidates) 

    // IMPORTANT: remember which room this transport belongs to
    transportToRoom.set(transport.id, this.id)

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      iceServers: parseTurnServersFromEnv(),
    }
  }

  async connectTransport(transportId: string, dtlsParameters: mediasoup.types.DtlsParameters) {
    const transport = this.transports.get(transportId)
    if (!transport) throw new Error('Transport not found')
    await transport.connect({ dtlsParameters })
  }

  async produce(
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: any,
    appData?: Record<string, any>
  ): Promise<mediasoup.types.Producer> {
    const transport = this.transports.get(transportId)
    if (!transport) throw new Error('Transport not found for produce')

    const producer = await transport.produce({ kind, rtpParameters, appData })
    this.producers.set(producer.id, producer)

    producer.on('transportclose', () => {
      this.producers.delete(producer.id)
    })
    // FIX: event name is 'close', not '@close'
    // producer.on('close', () => {
    //   this.producers.delete(producer.id)
    // })

    return producer
  }

  // in backend/src/mediasoup/roomManager.ts
async consume(
  consumerTransportId: string,
  producerId: string,
  rtpCapabilities: mediasoup.types.RtpCapabilities
) {
  if (!this.router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Cannot consume')
  }

  const transport = this.transports.get(consumerTransportId)
  if (!transport) throw new Error('Transport not found')

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: false, // we start unpaused
  })
  this.consumers.set(consumer.id, consumer)

  consumer.on('transportclose', () => {
    this.consumers.delete(consumer.id)
  })
  consumer.on('producerclose', () => {
    this.consumers.delete(consumer.id)
  })

  return {
    id: consumer.id,
    producerId: consumer.producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    paused: consumer.paused, // <— include this
  }
}


  async resumeConsumer(consumerId: string) {
    const consumer = this.consumers.get(consumerId)
    if (!consumer) throw new Error('Consumer not found')
    await consumer.resume()
  }

  async destroyTransport(transportId: string) {
    const t = this.transports.get(transportId)
    if (!t) return
    try {
      await t.close()
    } catch {
      /* ignore */
    }
    this.transports.delete(transportId)
    // IMPORTANT: clean reverse map
    transportToRoom.delete(transportId)
  }

  async closeProducer(producerId: string) {
    const p = this.producers.get(producerId)
    if (!p) return
    try {
      await p.close()
    } catch {
      /* ignore */
    }
    this.producers.delete(producerId)
  }

  async close() {
    try {
      // close transports and clean reverse map
      for (const t of Array.from(this.transports.values())) {
        try {
          await t.close()
        } catch {
          /* ignore */
        }
        transportToRoom.delete(t.id) // IMPORTANT: also clean mapping on room close
      }
      // close producers/consumers
      for (const p of Array.from(this.producers.values())) {
        try {
          await p.close()
        } catch {
          /* ignore */
        }
      }
      for (const c of Array.from(this.consumers.values())) {
        try {
          await c.close()
        } catch {
          /* ignore */
        }
      }
      this.transports.clear()
      this.producers.clear()
      this.consumers.clear()
      try {
        await this.router.close()
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.warn('Error closing room', err)
    }
  }
}

/* ---------- room registry helpers ---------- */
export async function getOrCreateRoom(roomId: string) {
  let r = rooms.get(roomId)
  if (!r) {
    r = await Room.create(roomId)
    rooms.set(roomId, r)
    console.log(`Created mediasoup room ${roomId}`)
  }
  return r
}

export function getRoom(roomId: string) {
  console.log('RoomID', roomId)
  return rooms.get(roomId)
}

export async function closeRoom(roomId: string) {
  const r = rooms.get(roomId)
  if (!r) return
  await r.close()
  rooms.delete(roomId)
}

/* ---------- mediasoup worker bootstrap ---------- */

let workerInstance: mediasoup.types.Worker | null = null

export async function getMediasoupWorker(): Promise<mediasoup.types.Worker> {
  if (workerInstance) return workerInstance

  const numCores = Math.max(1, os.cpus().length)
  workerInstance = await mediasoup.createWorker({
    rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) || 49999,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp'],
  })

  workerInstance.on('died', () => {
    console.error('mediasoup Worker died, exiting in 2 seconds...')
    setTimeout(() => process.exit(1), 2000)
  })

  console.log(`mediasoup worker created (pid ${workerInstance.pid}) — cores: ${numCores}`)
  return workerInstance
}
