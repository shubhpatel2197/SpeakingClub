/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Device } from 'mediasoup-client'
import { io, Socket } from 'socket.io-client'
import { useSnackbar } from '../context/SnackbarProvider'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()

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
  const [micOn, setMicOn] = useState(false)      // start muted
  const [producing, setProducing] = useState(false)

  const peersRef = useRef<Record<string, Participant>>({})

  // Buffer of producers we need to consume once device/recv ready
  const pendingProducersRef = useRef<
    Array<{ id: string; producerPeerId?: string; userId?: string; name?: string; muted?: boolean }>
  >([])

  function emitPresence() {
    const list = Object.values(peersRef.current)
    setParticipants(list)
  }

  const attachConsumerTrack = useCallback((consumer: Consumer, key: string) => {
    try {
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

      audio.play().catch(() => {
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
          try { await audio.play(); btn.remove() } catch {}
        }
        document.body.appendChild(btn)
      })
    } catch (err) {
      console.error('[CL/ATTACH] error', err)
    }
  }, [])

  const cleanupPeerConsumer = useCallback((producerId: string) => {
    for (const [cid, consumer] of Object.entries(consumersRef.current)) {
      if ((consumer as any).producerId === producerId) {
        try { (consumer as any).close() } catch {}
        delete consumersRef.current[cid]
      }
    }
    const audio = audioElsRef.current[producerId]
    if (audio) {
      try { audio.parentNode?.removeChild(audio) } catch {}
      delete audioElsRef.current[producerId]
    }
  }, [])

  const cleanupAll = useCallback(() => {
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()) } catch {}
    localStreamRef.current = null

    Object.values(producersRef.current).forEach((p) => { try { (p as any).close() } catch {} })
    producersRef.current = {}

    Object.values(consumersRef.current).forEach((c) => { try { (c as any).close() } catch {} })
    consumersRef.current = {}

    Object.values(audioElsRef.current).forEach((el) => { try { el.parentNode?.removeChild(el) } catch {} })
    audioElsRef.current = {}

    try { sendTransportRef.current?.close() } catch {}
    sendTransportRef.current = null

    try { recvTransportRef.current?.close() } catch {}
    recvTransportRef.current = null

    deviceRef.current = null

    try { socketRef.current?.disconnect() } catch {}
    socketRef.current = null

    myPeerIdRef.current = null
    peersRef.current = {}
    pendingProducersRef.current = []

    setParticipants([])
    setMicOn(false)          // reset to muted
    setProducing(false)
  }, [])

  /** consume a single remote producer (if not self), ensuring recv transport exists */
  const consumeProducer = useCallback(
    async (socket: Socket, producerId: string) => {
      if (!recvTransportRef.current) {
        const tpParams = await new Promise<any>((resolve, reject) => {
          socket.emit('createWebRtcTransport', { roomId: currentRoomIdRef.current, direction: 'recv' }, (res: any) => {
            if (res?.error) return reject(res.error)
            resolve(res)
          })
        })
        if (!deviceRef.current) return
        const recvTransport: RecvTransport = (deviceRef.current as any).createRecvTransport(tpParams)
        recvTransportRef.current = recvTransport
        recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connectTransport', { transportId: recvTransport.id, dtlsParameters }, (res: any) => {
            if (res?.error) return errback(res.error)
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

      socket.emit('consumerResume', { consumerId: consumer.id })
    },
    [attachConsumerTrack]
  )

  /** After device ready, process all buffered producers */
  const flushPendingProducers = useCallback(async () => {
    const socket = socketRef.current
    if (!socket || !deviceRef.current) return
    const list = pendingProducersRef.current.splice(0)
    if (!list.length) return

    for (const p of list) {
      if (p.producerPeerId && p.producerPeerId === myPeerIdRef.current) continue
      try { await consumeProducer(socket, p.id) } catch (e) { console.error('[CL/FLUSH] consume error', e) }
    }
  }, [consumeProducer])

  const currentRoomIdRef = useRef<string>('')

  /* ---------- core: joinRoom (start muted) ---------- */
  const joinRoom = useCallback(
    async (roomId: string) => {
      if (socketRef.current) {
        console.warn('[CL] already connected; call leaveRoom first')
        return
      }
      currentRoomIdRef.current = roomId

      // Get mic permission but keep track disabled
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = stream
        const track = stream.getAudioTracks()[0]
        if (track) track.enabled = false         // start muted
        setMicOn(false)                          // reflect muted UI
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

      // server events
      socket.on(
        'roomInfo',
        async (data: {
          peers: Array<{ peerId: string; userId?: string; name?: string }>
          producers?: Array<{ id: string; producerPeerId?: string; userId?: string; name?: string; muted?: boolean }>
        }) => {
          const next: Record<string, Participant> = {}
          for (const p of data.peers || []) {
            next[p.peerId] = {
              peerId: p.peerId,
              userId: p.userId,
              id: p.userId || p.peerId,
              name: p.name || p.userId || p.peerId,
              muted: true,
            }
          }
          peersRef.current = next
          setParticipants(Object.values(next))

          if (Array.isArray(data.producers)) {
            for (const prod of data.producers) {
              if (prod.producerPeerId && !peersRef.current[prod.producerPeerId]) {
                peersRef.current[prod.producerPeerId] = {
                  peerId: prod.producerPeerId,
                  userId: prod.userId,
                  id: prod.userId || prod.producerPeerId,
                  name: prod.name || prod.userId || prod.producerPeerId,
                  muted: prod.muted,
                }
              } else if (prod.producerPeerId && peersRef.current[prod.producerPeerId]) {
                peersRef.current[prod.producerPeerId] = {
                  ...peersRef.current[prod.producerPeerId],
                  muted: prod.muted,
                }
              }
              setParticipants(Object.values(peersRef.current))
              pendingProducersRef.current.push(prod)
            }
          }

          if (deviceRef.current) await flushPendingProducers()
        }
      )

      socket.on('peerJoined', ({ peerId, userId, name }) => {
        peersRef.current[peerId] = {
          peerId, userId, id: userId || peerId, name: name || userId || peerId,
          muted: typeof peersRef.current[peerId]?.muted === 'boolean' ? peersRef.current[peerId]?.muted : (peersRef.current[peerId]?.muted ?? true),

        }
        setParticipants(Object.values(peersRef.current))
      })
      socket.on('peerLeft', ({ peerId }) => {
        delete peersRef.current[peerId]
        setParticipants(Object.values(peersRef.current))
      })

      socket.on(
        'newProducer',
        async (data: { producerId: string; producerPeerId: string; userId?: string; name?: string; muted?: boolean }) => {
          const prev = peersRef.current[data.producerPeerId]
          peersRef.current[data.producerPeerId] = {
            peerId: data.producerPeerId,
            userId: data.userId ?? prev?.userId,
            id: data.userId ?? prev?.id ?? data.producerPeerId,
            name: data.name ?? prev?.name ?? data.userId ?? data.producerPeerId,
            muted: typeof data.muted === 'boolean' ? data.muted : prev?.muted,
          }
          emitPresence()

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
            if (data.producerPeerId !== myPeerIdRef.current) {
              try { await consumeProducer(socket, data.producerId) } catch (e) { console.error('[CL/newProducer] consume', e) }
            }
          }
        }
      )

      socket.on('producerMuted', ({ peerId, userId, muted }) => {
        const prev = peersRef.current[peerId]
        if (prev) {
          peersRef.current[peerId] = { ...prev, muted: !!muted }
          emitPresence()
        }
      })

      socket.on('producerClosed', ({ producerId }) => {
        cleanupPeerConsumer(producerId)
      })

      // 1) join
      await new Promise<void>((resolve) => {
        socket.emit('joinRoom', { roomId }, (res: any) => {
          if (res?.error) {
            console.error('[CL/JOIN] error', res.error)
            // navigate('/', { replace: true })
            // return reject(new Error(res.error))
          }
          resolve()
        })
      })

      // 2) device + send transport (no producing yet)
      try {
        const routerRtpCapabilities = await reqRouterCaps()
        const device = new Device()
        await device.load({ routerRtpCapabilities })
        deviceRef.current = device

        await flushPendingProducers()

        const sendTpParams = await reqCreateTransport('send')
        const sendTransport: SendTransport = (device as any).createSendTransport(sendTpParams)
        sendTransportRef.current = sendTransport

        sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connectTransport', { transportId: sendTransport.id, dtlsParameters }, (res: any) => {
            if (res?.error) return errback(res.error)
            callback()
          })
        })

        sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
          socket.emit('produce', { transportId: sendTransport.id, kind, rtpParameters }, (res: any) => {
            if (res?.error) return errback(res.error)
            callback({ id: res.producerId })
          })
        })

        // IMPORTANT: do NOT produce here. We start muted.
        // Producer will be created on first unmute in toggleMic.
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

  // toggleMic creates producer on first unmute; then pause/resume on subsequent toggles
  const toggleMic = useCallback(async () => {
    const stream = localStreamRef.current
    if (!stream) return
    const track = stream.getAudioTracks()[0]
    if (!track) return

    const turningOn = !track.enabled

    // turning ON
    if (turningOn) {
      // ensure send transport exists
      if (!sendTransportRef.current) {
        console.warn('[CL/MIC] no send transport yet')
        return
      }

      // create a producer if we don't have one
      let producer = Object.values(producersRef.current)[0] as any | undefined
      if (!producer) {
        try {
          producer = await (sendTransportRef.current as any).produce({ track })
          producersRef.current[producer.id] = producer
          setProducing(true)
        } catch (e) {
          console.error('[CL/MIC] produce failed', e)
          return
        }
      } else {
        try { producer.resume?.() } catch {}
      }

      track.enabled = true
      setMicOn(true)
      try { socketRef.current?.emit('producerMuted', { muted: false }) } catch {}
      return
    }

    // turning OFF
    track.enabled = false
    setMicOn(false)

    const producer = Object.values(producersRef.current)[0] as any | undefined
    if (producer) {
      try { producer.pause?.() } catch {}
    }
    try { socketRef.current?.emit('producerMuted', { muted: true }) } catch {}
  }, [])

  useEffect(() => {
    return () => {
      cleanupAll()
      window.removeEventListener('beforeunload', cleanupAll)
    }
  }, [cleanupAll])

  return { joinRoom, leaveRoom, toggleMic, micOn, participants, producing }
}
