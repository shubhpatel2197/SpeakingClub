/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Device } from 'mediasoup-client'
import { io, Socket } from 'socket.io-client'
import { useSnackbar } from '../context/SnackbarProvider'

type SendTransport = ReturnType<Device['createSendTransport']>
type RecvTransport = ReturnType<Device['createRecvTransport']>
type Producer = any
type Consumer = any

type Participant = {
  id: string            // prefer userId; fallback to peerId
  peerId?: string
  userId?: string
  name?: string | null
  muted?: boolean
}

const SIGNALING_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : `http://app.local:8443` 

export function useMediasoup() {
  const { showSnackbar } = useSnackbar()

  const socketRef = useRef<Socket | null>(null)
  const myPeerIdRef = useRef<string | null>(null)

  const deviceRef = useRef<Device | null>(null)
  const sendTransportRef = useRef<SendTransport | null>(null)
  const recvTransportRef = useRef<RecvTransport | null>(null)
  const producersRef = useRef<Record<string, Producer>>({})
  const consumersRef = useRef<Record<string, Consumer>>({})
  const audioElsRef = useRef<Record<string, HTMLAudioElement>>({})
  const localStreamRef = useRef<MediaStream | null>(null)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [micOn, setMicOn] = useState(false)
  const [producing, setProducing] = useState(false)

  const peersRef = useRef<Record<string, Participant>>({})

  // Buffer of producers we need to consume once device/recv ready
  const pendingProducersRef = useRef<
    Array<{ id: string; producerPeerId?: string; userId?: string; name?: string; muted?: boolean }>
  >([])

  function emitPresence() {
    const list = Object.values(peersRef.current)
    console.log('[CL/PRESENCE] ->', list)
    setParticipants(list)
  }

  const attachConsumerTrack = useCallback((consumer: Consumer, key: string) => {
    try {
      console.log('[CL/ATTACH] key=', key, 'consumerId=', consumer?.id)
      const ms = new MediaStream()
      ms.addTrack(consumer.track)

      let audio = audioElsRef.current[key]
      if (!audio) {
        audio = document.createElement('audio')
        audio.setAttribute('playsinline', '')
        audio.autoplay = true
        audio.controls = false
        audio.volume = 1
        ;(document.getElementById('remote-audio-container') ?? document.body).appendChild(audio)
        audioElsRef.current[key] = audio
      }
      // @ts-ignore
      audio.srcObject = ms

      audio
        .play()
        .then(() => console.log('[CL/ATTACH] audio.play() ok for', key))
        .catch((err) => {
          console.warn('[CL/ATTACH] autoplay blocked, showing button', err)
          const btn = document.createElement('button')
          btn.textContent = 'Enable audio'
          Object.assign(btn.style, {
            position: 'fixed',
            right: '16px',
            bottom: '16px',
            zIndex: '9999',
            padding: '8px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
          })
          btn.onclick = async () => {
            try {
              await audio.play()
              btn.remove()
            } catch (e) {
              console.error('Manual audio.play() still blocked', e)
            }
          }
          document.body.appendChild(btn)
        })
    } catch (err) {
      console.error('[CL/ATTACH] error', err)
    }
  }, [])

  const cleanupPeerConsumer = useCallback((producerId: string) => {
    console.log('[CL/CLEAN] producerId=', producerId)
    for (const [cid, consumer] of Object.entries(consumersRef.current)) {
      if ((consumer as any).producerId === producerId) {
        try {
          (consumer as any).close()
        } catch {}
        delete consumersRef.current[cid]
      }
    }
    const audio = audioElsRef.current[producerId]
    if (audio) {
      try {
        audio.parentNode?.removeChild(audio)
      } catch {}
      delete audioElsRef.current[producerId]
    }
  }, [])

  const cleanupAll = useCallback(() => {
    console.log('[CL/CLEAN ALL] begin')
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
    } catch {}
    localStreamRef.current = null

    Object.values(producersRef.current).forEach((p) => {
      try {
        ;(p as any).close()
      } catch {}
    })
    producersRef.current = {}

    Object.values(consumersRef.current).forEach((c) => {
      try {
        ;(c as any).close()
      } catch {}
    })
    consumersRef.current = {}

    Object.values(audioElsRef.current).forEach((el) => {
      try {
        el.parentNode?.removeChild(el)
      } catch {}
    })
    audioElsRef.current = {}

    try {
      sendTransportRef.current?.close()
    } catch {}
    sendTransportRef.current = null

    try {
      recvTransportRef.current?.close()
    } catch {}
    recvTransportRef.current = null

    deviceRef.current = null

    try {
      socketRef.current?.disconnect()
    } catch {}
    socketRef.current = null

    myPeerIdRef.current = null
    peersRef.current = {}
    pendingProducersRef.current = []

    setParticipants([])
    setMicOn(false)
    setProducing(false)
    console.log('[CL/CLEAN ALL] done')
  }, [])

  /** consume a single remote producer (if not self), ensuring recv transport exists */
  const consumeProducer = useCallback(
    async (socket: Socket, producerId: string) => {
      const myPeerId = myPeerIdRef.current
      // find owner of this producer from presence if we have it
      const ownerPeer = Object.values(peersRef.current).find((p) =>
        Object.values(consumersRef.current).some((c: any) => c?.producerId === producerId)
      )
      // Client-side self-filter uses the server-provided peerId when enqueuing (see handlers below),
      // but we also guard on the final consume call if needed.

      // Ensure recv transport created & connected
      if (!recvTransportRef.current) {
        console.log('[CL/RECV] creating recv transport…')
        const tpParams = await new Promise<any>((resolve, reject) => {
          socket.emit('createWebRtcTransport', { roomId: currentRoomIdRef.current, direction: 'recv' }, (res: any) => {
            if (res?.error) return reject(res.error)
            resolve(res)
          })
        })
        if (!deviceRef.current) {
          console.warn('[CL/RECV] device not ready; abort consume')
          return
        }
        const recvTransport: RecvTransport = (deviceRef.current as any).createRecvTransport(tpParams)
        recvTransportRef.current = recvTransport
        recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connectTransport', { transportId: recvTransport.id, dtlsParameters }, (res: any) => {
            if (res?.error) {
              console.error('[CL/RECV] connect error', res.error)
              return errback(res.error)
            }
            console.log('[CL/RECV] connected')
            callback()
          })
        })
      }

      const consumerParams = await new Promise<any>((resolve, reject) => {
        socket.emit(
          'consume',
          { roomId: currentRoomIdRef.current, producerId, rtpCapabilities: deviceRef.current?.rtpCapabilities },
          (res: any) => {
            if (res?.error) return reject(res.error)
            resolve(res)
          }
        )
      })

      const consumer: Consumer = await (recvTransportRef.current as any).consume({
        id: consumerParams.id,
        producerId: consumerParams.producerId,
        kind: consumerParams.kind,
        rtpParameters: consumerParams.rtpParameters,
      })
      consumersRef.current[consumer.id] = consumer
      attachConsumerTrack(consumer, consumer.producerId)

      // server also resumes, but ok to request:
      socket.emit('consumerResume', { consumerId: consumer.id })

      console.log('[CL/CONSUME] ok consumerId=', consumer.id, 'for producer=', producerId)
    },
    [attachConsumerTrack]
  )

  /** After device ready, process all buffered producers */
  const flushPendingProducers = useCallback(async () => {
    const socket = socketRef.current
    if (!socket) return
    if (!deviceRef.current) return
    const list = pendingProducersRef.current.splice(0)
    if (!list.length) return
    console.log('[CL/FLUSH] pending producers=', list.length)

    for (const p of list) {
      // Skip my own producer (by peerId match)
      if (p.producerPeerId && p.producerPeerId === myPeerIdRef.current) {
        console.log('[CL/FLUSH] skip self producer', p.id)
        continue
      }
      try {
        await consumeProducer(socket, p.id)
      } catch (e) {
        console.error('[CL/FLUSH] consume error', e)
      }
    }
  }, [consumeProducer])

  const currentRoomIdRef = useRef<string>('')

  /* ---------- core: joinRoom ---------- */
  const joinRoom = useCallback(
    async (roomId: string) => {
      if (socketRef.current) {
        console.warn('[CL] already connected; call leaveRoom first')
        return
      }
      currentRoomIdRef.current = roomId

      console.log('[CL/GUM] start')
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = stream
        setMicOn(true)
        console.log('[CL/GUM] ok, tracks=', stream.getAudioTracks().length)
      } catch (err) {
        console.error('[CL/GUM] failed', err)
        showSnackbar('Microphone permission denied', { severity: 'error' })
        throw err
      }

      const socket = io('/', {
        path: '/socket.io',
        transports: ['websocket'],
        withCredentials: true,
        timeout: 20000,
      })
      socketRef.current = socket

      socket.on('connect', () => {
        myPeerIdRef.current = socket.id as string
        console.log('[CL/SOCK] connected id=', socket.id)
      })
      socket.on('connect_error', (e) => console.error('[CL/SOCK] connect_error', e))
      socket.on('disconnect', (r) => console.log('[CL/SOCK] disconnect', r))

      // Helpers
      const reqRouterCaps = () =>
        new Promise<any>((resolve, reject) => {
          socket.emit('getRouterRtpCapabilities', { roomId }, (res: any) => {
            if (res?.error) return reject(res.error)
            resolve(res.routerRtpCapabilities)
          })
        })
      const reqCreateTransport = (direction: 'send' | 'recv') =>
        new Promise<any>((resolve, reject) => {
          socket.emit('createWebRtcTransport', { roomId, direction }, (res: any) => {
            if (res?.error) return reject(res.error)
            resolve(res)
          })
        })

      /* ---------- server events ---------- */

      // Initial state
      socket.on(
        'roomInfo',
        async (data: {
          peers: Array<{ peerId: string; userId?: string; name?: string }>
          producers?: Array<{ id: string; producerPeerId?: string; userId?: string; name?: string; muted?: boolean }>
        }) => {
          console.log('[CL/ROOMINFO] peers=', data.peers?.length || 0, 'producers=', data.producers?.length || 0)

          // Presence map
          const next: Record<string, Participant> = {}
          for (const p of data.peers || []) {
            next[p.peerId] = {
              peerId: p.peerId,
              userId: p.userId,
              id: p.userId || p.peerId,
              name: p.name || p.userId || p.peerId,
              muted: undefined,
            }
          }
          peersRef.current = next
          emitPresence()

          // Buffer producers until device ready
          if (Array.isArray(data.producers)) {
            for (const prod of data.producers) {
              // Show owner presence/mute if not in peers (creator may be alone)
              if (prod.producerPeerId && !peersRef.current[prod.producerPeerId]) {
                peersRef.current[prod.producerPeerId] = {
                  peerId: prod.producerPeerId,
                  userId: prod.userId,
                  id: prod.userId || prod.producerPeerId,
                  name: prod.name || prod.userId || prod.producerPeerId,
                  muted: prod.muted,
                }
                emitPresence()
              } else if (prod.producerPeerId && peersRef.current[prod.producerPeerId]) {
                peersRef.current[prod.producerPeerId] = {
                  ...peersRef.current[prod.producerPeerId],
                  muted: prod.muted,
                }
                emitPresence()
              }

              // enqueue for consumption (we'll filter self later)
              pendingProducersRef.current.push(prod)
            }
          }

          // If device already ready, flush now
          if (deviceRef.current) {
            await flushPendingProducers()
          }
        }
      )

      // Presence events
      socket.on('peerJoined', ({ peerId, userId, name }) => {
        console.log('[CL/EVENT] peerJoined', { peerId, userId, name })
        peersRef.current[peerId] = {
          peerId,
          userId,
          id: userId || peerId,
          name: name || userId || peerId,
          muted: peersRef.current[peerId]?.muted,
        }
        emitPresence()
      })
      socket.on('peerLeft', ({ peerId }) => {
        console.log('[CL/EVENT] peerLeft', { peerId })
        delete peersRef.current[peerId]
        emitPresence()
      })

      // New producer after we joined
      socket.on(
        'newProducer',
        async (data: { producerId: string; producerPeerId: string; userId?: string; name?: string; muted?: boolean }) => {
          console.log('[CL/EVENT] newProducer', data)

          // Update presence
          const prev = peersRef.current[data.producerPeerId]
          peersRef.current[data.producerPeerId] = {
            peerId: data.producerPeerId,
            userId: data.userId ?? prev?.userId,
            id: data.userId ?? prev?.id ?? data.producerPeerId,
            name: data.name ?? prev?.name ?? data.userId ?? data.producerPeerId,
            muted: typeof data.muted === 'boolean' ? data.muted : prev?.muted,
          }
          emitPresence()

          // Buffer if device not ready; otherwise consume now (skip self)
          const payload = {
            id: data.producerId,
            producerPeerId: data.producerPeerId,
            userId: data.userId,
            name: data.name,
            muted: data.muted,
          }
          if (!deviceRef.current) {
            pendingProducersRef.current.push(payload)
          } else {
            if (data.producerPeerId === myPeerIdRef.current) {
              console.log('[CL/EVENT] newProducer: skip self')
            } else {
              try {
                await consumeProducer(socket, data.producerId)
              } catch (e) {
                console.error('[CL/EVENT] newProducer consume error', e)
              }
            }
          }
        }
      )

      socket.on('producerMuted', ({ peerId, userId, muted }) => {
        console.log('[CL/EVENT] producerMuted', { peerId, userId, muted })
        const prev = peersRef.current[peerId]
        if (prev) {
          peersRef.current[peerId] = { ...prev, muted: !!muted }
          emitPresence()
        }
      })

      socket.on('producerClosed', ({ producerId }) => {
        console.log('[CL/EVENT] producerClosed', { producerId })
        cleanupPeerConsumer(producerId)
      })

      /* ---------- 1) join ---------- */
      await new Promise<void>((resolve, reject) => {
        socket.emit('joinRoom', { roomId }, (res: any) => {
          if (res?.error) return reject(new Error(res.error))
          console.log('[CL/JOIN] ok')
          resolve()
        })
      })

      /* ---------- 2) device + send transport ---------- */
      try {
        const routerRtpCapabilities = await reqRouterCaps()
        const device = new Device()
        await device.load({ routerRtpCapabilities })
        deviceRef.current = device
        console.log('[CL/DEVICE] loaded')

        // Now that device is ready, flush any pre-received producers
        await flushPendingProducers()

        const sendTpParams = await reqCreateTransport('send')
        const sendTransport: SendTransport = (device as any).createSendTransport(sendTpParams)
        sendTransportRef.current = sendTransport
        console.log('[CL/SEND] transport created id=', sendTransport.id)

        sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connectTransport', { transportId: sendTransport.id, dtlsParameters }, (res: any) => {
            if (res?.error) {
              console.error('[CL/SEND] connect error:', res.error)
              return errback(res.error)
            }
            console.log('[CL/SEND] connected')
            callback()
          })
        })

        sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
          socket.emit('produce', { transportId: sendTransport.id, kind, rtpParameters }, (res: any) => {
            if (res?.error) {
              console.error('[CL/SEND] produce error', res.error)
              return errback(res.error)
            }
            console.log('[CL/SEND] produce ack id=', res.producerId)
            callback({ id: res.producerId })
          })
        })

        // Produce local audio (mic)
        const track = localStreamRef.current!.getAudioTracks()[0]
        const producer: Producer = await (sendTransport as any).produce({ track })
        producersRef.current[producer.id] = producer
        setProducing(true)
        console.log('[CL/SEND] local producer id=', producer.id)
      } catch (err) {
        console.error('[CL/INIT] error', err)
        cleanupAll()
        throw err
      }

      window.addEventListener('beforeunload', cleanupAll)
    },
    [attachConsumerTrack, cleanupAll, consumeProducer, flushPendingProducers, showSnackbar]
  )

  const leaveRoom = useCallback(() => {
    try { socketRef.current?.emit('leaveRoom') } catch {}
    cleanupAll()
    window.removeEventListener('beforeunload', cleanupAll)
  }, [cleanupAll])

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const track = stream.getAudioTracks()[0]
    if (!track) return
    const next = !track.enabled
    track.enabled = next
    setMicOn(next)
    console.log('[CL/MIC] set track.enabled=', next)
    try {
      socketRef.current?.emit('producerMuted', { muted: !next })
    } catch {}
  }, [])

  useEffect(() => {
    return () => {
      cleanupAll()
      window.removeEventListener('beforeunload', cleanupAll)
    }
  }, [cleanupAll])

  return { joinRoom, leaveRoom, toggleMic, micOn, participants, producing }
}
