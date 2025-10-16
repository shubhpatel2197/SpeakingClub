// backend/src/mediasoup/workerManager.ts
import * as mediasoup from 'mediasoup'
import os from 'os'

let worker: mediasoup.types.Worker | null = null

export async function getMediasoupWorker(): Promise<mediasoup.types.Worker> {
  if (worker) return worker

  const numCores = Math.max(1, os.cpus().length)
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp'],
  })

  worker.on('died', () => {
    console.error('mediasoup Worker died, exiting in 2 seconds...')
    setTimeout(() => process.exit(1), 2000)
  })

  console.log(`mediasoup worker created (pid ${worker.pid}) — cores: ${numCores}`)
  return worker
}
