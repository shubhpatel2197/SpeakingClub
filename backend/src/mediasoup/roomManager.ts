// backend/src/mediasoup/roomManager.ts
import * as mediasoup from "mediasoup";
import os from "os";
import dotenv from "dotenv";

dotenv.config();

const STUN_SERVER = { urls: "stun:stun.l.google.com:19302" };

type CreateTransportOpts = {
  enableSctp?: boolean;
};

type RtcIceServer = { urls: string | string[]; username?: string; credential?: string };

function parseTurnServersFromEnv(): RtcIceServer[] {
  const uris = (process.env.TURN_URIS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (uris.length === 0) return [STUN_SERVER];
  const username = process.env.TURN_USERNAME || "";
  const credential = process.env.TURN_CREDENTIAL || "";
  return uris.map((u) => ({ urls: u, username, credential }));
}

/** Router codec set — Opus + VP8 + H264 (baseline/level 3.1) */
const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
    preferredPayloadType: 111,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    preferredPayloadType: 96,
    rtcpFeedback: [
      { type: "nack" },
      { type: "nack", parameter: "pli" },
      { type: "ccm", parameter: "fir" },
      { type: "goog-remb" },
      { type: "transport-cc" },
    ],
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    preferredPayloadType: 102,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
    },
    rtcpFeedback: [
      { type: "nack" },
      { type: "nack", parameter: "pli" },
      { type: "ccm", parameter: "fir" },
      { type: "goog-remb" },
      { type: "transport-cc" },
    ],
  },
  {
  kind: "video",
  mimeType: "video/VP9",
  clockRate: 90000,
  rtcpFeedback: [
    { type: "nack" },
    { type: "nack", parameter: "pli" },
    { type: "ccm", parameter: "fir" },
    { type: "transport-cc" }
  ],
  preferredPayloadType: 98
},
];


/* ---------- registries exported for socket handlers ---------- */
export const rooms = new Map<string, Room>();
export const transportToRoom = new Map<string, string>(); // transportId -> roomId

/**
 * Room class — manages Router, transports, producers, consumers for a single room.
 */
export class Room {
  public id: string;
  public router: mediasoup.types.Router;
  public transports: Map<string, mediasoup.types.WebRtcTransport> = new Map();
  public producers: Map<string, mediasoup.types.Producer> = new Map();
  public consumers: Map<string, mediasoup.types.Consumer> = new Map();
  public dataProducers: Map<string, mediasoup.types.DataProducer> = new Map();
  public dataConsumers: Map<string, mediasoup.types.DataConsumer> = new Map();

  constructor(id: string, router: mediasoup.types.Router) {
    this.id = id;
    this.router = router;
  }

  static async create(id: string) {
    const worker = await getMediasoupWorker();
    const router = await worker.createRouter({
      // IMPORTANT: pass the array directly, not [{ mediaCodecs }]
      mediaCodecs,
    });
    return new Room(id, router);
  }

  getRouterRtpCapabilities(): mediasoup.types.RtpCapabilities {
    return this.router.rtpCapabilities;
  }

  // create a WebRtcTransport, store it, and return the params client needs
  async createWebRtcTransport(
    opts: CreateTransportOpts = {}
  ): Promise<{
    id: string;
    iceParameters: mediasoup.types.IceParameters;
    iceCandidates: mediasoup.types.IceCandidate[];
    dtlsParameters: mediasoup.types.DtlsParameters;
    iceServers: RtcIceServer[];
    sctpParameters?: mediasoup.types.SctpParameters;
  }> {
    const webRtcTransportOptions: mediasoup.types.WebRtcTransportOptions = {
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: process.env.ANNOUNCED_IP || undefined, // public IP if behind NAT
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 8_000_000,
      enableSctp: opts.enableSctp !== false,
      numSctpStreams: { OS: 1024, MIS: 1024 },
      appData: {},
    };

    const transport = await this.router.createWebRtcTransport(webRtcTransportOptions);
    await transport.setMaxIncomingBitrate?.(12_000_000);
    this.transports.set(transport.id, transport);
    // remember which room this transport belongs to
    transportToRoom.set(transport.id, this.id);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      iceServers: parseTurnServersFromEnv(),
      sctpParameters: transport.sctpParameters,
    };
  }

  async connectTransport(transportId: string, dtlsParameters: mediasoup.types.DtlsParameters) {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error("Transport not found");
    await transport.connect({ dtlsParameters });
  }

  async produce(
    transportId: string,
    kind: "audio" | "video",
    rtpParameters: mediasoup.types.RtpParameters,
    appData?: Record<string, any>
  ): Promise<mediasoup.types.Producer> {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error("Transport not found for produce");

    const producer = await transport.produce({ kind, rtpParameters, appData });
    this.producers.set(producer.id, producer);

    producer.on("transportclose", () => {
      this.producers.delete(producer.id);
    });
    // producer.on("close", () => {
    //   this.producers.delete(producer.id);
    // });

    return producer;
  }

  async consume(
    consumerTransportId: string,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities
  ): Promise<{
    id: string;
    producerId: string;
    kind: mediasoup.types.MediaKind;
    rtpParameters: mediasoup.types.RtpParameters;
    paused: boolean;
  }> {
    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error("Cannot consume");
    }

    const transport = this.transports.get(consumerTransportId);
    if (!transport) throw new Error("Transport not found");

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false, // start unpaused
    });
    this.consumers.set(consumer.id, consumer);

    consumer.on("transportclose", () => {
      this.consumers.delete(consumer.id);
    });
    consumer.on("producerclose", () => {
      this.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      paused: consumer.paused,
    };
  }

  async produceData(transportId: string, opts: {
    sctpStreamParameters: mediasoup.types.SctpStreamParameters;
    label?: string;
    protocol?: string;
  }): Promise<mediasoup.types.DataProducer> {
    const transport = this.transports.get(transportId) as mediasoup.types.WebRtcTransport | undefined;
    if (!transport) throw new Error("transport not found");

    const dataProducer = await transport.produceData({
      sctpStreamParameters: opts.sctpStreamParameters,
      label: opts.label,
      protocol: opts.protocol,
    });

    this.dataProducers.set(dataProducer.id, dataProducer);
    dataProducer.on("transportclose", () => {
      this.dataProducers.delete(dataProducer.id);
    });

    return dataProducer;
  }

  async consumeData(
    transportId: string,
    dataProducerId: string
  ): Promise<{
    id: string;
    dataProducerId: string;
    sctpStreamParameters: mediasoup.types.SctpStreamParameters;
    label?: string;
    protocol?: string;
  }> {
    const transport = this.transports.get(transportId) as mediasoup.types.WebRtcTransport | undefined;
    if (!transport) throw new Error("transport not found");

    const dataConsumer = await transport.consumeData({ dataProducerId });

    this.dataConsumers.set(dataConsumer.id, dataConsumer);
    dataConsumer.on("transportclose", () => {
      this.dataConsumers.delete(dataConsumer.id);
    });

    return {
      id: dataConsumer.id,
      dataProducerId: dataConsumer.dataProducerId,
      sctpStreamParameters: dataConsumer.sctpStreamParameters,
      label: dataConsumer.label,
      protocol: dataConsumer.protocol,
    };
  }

  async resumeConsumer(consumerId: string) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) throw new Error("Consumer not found");
    await consumer.resume();
  }

  async closeDataProducer(dataProducerId: string) {
    const dp = this.dataProducers.get(dataProducerId);
    if (dp) {
      try {
        await dp.close();
      } catch {}
      this.dataProducers.delete(dataProducerId);
    }
  }

  async destroyTransport(transportId: string) {
    const t = this.transports.get(transportId);
    if (!t) return;
    try {
      await t.close();
    } catch {}
    this.transports.delete(transportId);
    transportToRoom.delete(transportId);
  }

  async closeProducer(producerId: string) {
    const p = this.producers.get(producerId);
    if (!p) return;
    try {
      await p.close();
    } catch {}
    this.producers.delete(producerId);
  }

  async close() {
    try {
      for (const t of Array.from(this.transports.values())) {
        try {
          await t.close();
        } catch {}
        transportToRoom.delete(t.id);
      }
      for (const p of Array.from(this.producers.values())) {
        try {
          await p.close();
        } catch {}
      }
      for (const c of Array.from(this.consumers.values())) {
        try {
          await c.close();
        } catch {}
      }
      this.transports.clear();
      this.producers.clear();
      this.consumers.clear();
      try {
        await this.router.close();
      } catch {}
    } catch (err) {
      console.warn("Error closing room", err);
    }
  }
}

/* ---------- room registry helpers ---------- */
export async function getOrCreateRoom(roomId: string) {
  let r = rooms.get(roomId);
  if (!r) {
    r = await Room.create(roomId);
    rooms.set(roomId, r);
    console.log(`Created mediasoup room ${roomId}`);
  }
  return r;
}

export function getRoom(roomId: string) {
  return rooms.get(roomId);
}

export async function closeRoom(roomId: string) {
  const r = rooms.get(roomId);
  if (!r) return;
  await r.close();
  rooms.delete(roomId);
}

/* ---------- mediasoup worker bootstrap ---------- */

let workerInstance: mediasoup.types.Worker | null = null;

export async function getMediasoupWorker(): Promise<mediasoup.types.Worker> {
  if (workerInstance) return workerInstance;

  const numCores = Math.max(1, os.cpus().length);
  workerInstance = await mediasoup.createWorker({
    rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) || 49999,
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp"],
  });

  workerInstance.on("died", () => {
    console.error("mediasoup Worker died, exiting in 2 seconds...");
    setTimeout(() => process.exit(1), 2000);
  });

  console.log(
    `mediasoup worker created (pid ${workerInstance.pid}) — cores: ${numCores}`
  );
  return workerInstance;
}
