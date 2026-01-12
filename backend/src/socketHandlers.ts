import http from "http";
import { Server as IOServer, Socket } from "socket.io";
import { parse as parseCookie } from "cookie";
import jwt from "jsonwebtoken";
import {
  getOrCreateRoom,
  getRoom,
  transportToRoom,
} from "./mediasoup/roomManager";
import { removeUserFromGroup, joinGroupCore } from "./services/groupService";
import prisma from "./lib/prisma";

type JwtPayload = {
  userId: string;
  iat: number;
  exp: number;
  name?: string;
  email?: string;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

type AuthedUser = { id: string; name?: string; email?: string };

type AuthedSocket = Socket & {
  data: {
    user?: AuthedUser;
    roomId?: string;
    sendTransportId?: string;
    recvTransportId?: string;
    transports?: Set<string>;
    producers?: Set<string>;
    dataProducers?: Set<string>;
  };
};

/** NEW: per-room screen-share state */
type ScreenShareState = {
  userId: string;
  name?: string | null;
  videoProducerId?: string | null;
  audioProducerId?: string | null;
};
const screenShareByRoom = new Map<string, ScreenShareState | undefined>();

function findOwnerOfDataProducer(io: IOServer, dataProducerId: string) {
  for (const [, sRaw] of io.sockets.sockets) {
    const s = sRaw as AuthedSocket;
    if (s.data.dataProducers?.has(dataProducerId)) {
      return { socketId: s.id, user: s.data.user };
    }
  }
  return null;
}

function findSocketInRoomByUser(
  io: IOServer,
  roomId: string,
  userId: string
): AuthedSocket | null {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return null;
  for (const sid of room) {
    const s = io.sockets.sockets.get(sid) as AuthedSocket | undefined;
    if (s?.data.user?.id === userId) return s || null;
  }
  return null;
}

function getUserFromHandshake(socket: Socket): AuthedUser | null {
  const raw = socket.handshake?.headers?.cookie || "";
  const cookies = parseCookie(raw || "");
  const token = cookies.token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return { id: payload.userId, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}

function findOwnerOfProducer(io: IOServer, producerId: string) {
  for (const [, sRaw] of io.sockets.sockets) {
    const s = sRaw as AuthedSocket;
    if (s.data.producers?.has(producerId)) {
      return { socketId: s.id, user: s.data.user };
    }
  }
  return null;
}

export function attachSocketServer(io: IOServer) {

  io.use((socket, next) => {
    const s = socket as AuthedSocket;
    const user = getUserFromHandshake(socket);
    if (!user) return next(new Error("unauthorized"));
    s.data.user = user;
    next();
  });

  io.on("connection", (raw) => {
    const socket = raw as AuthedSocket;
    console.log("[SOCKET] connected", socket.id, "user=", socket.data.user);


    socket.on("groups:subscribe", () => {
      socket.join("groups");
      socket.emit("groups:refresh");
    });

    socket.on("groups:unsubscribe", () => {
      socket.leave("groups");
    });

    /** JOIN */
    socket.on(
      "joinRoom",
      async ({ roomId }: { roomId: string }, cb?: (res: any) => void) => {
        try {
          const room = await getOrCreateRoom(roomId);
          await socket.join(roomId);
          socket.data.roomId = roomId;

          const existing = findSocketInRoomByUser(
            io,
            roomId,
            socket.data.user.id
          );

          if (existing && existing.id !== socket.id) {
            console.log("[SOCKET] replacing existing", existing.id);

            try {
              await removeUserFromGroup(existing.data.user.id, roomId);  
              await cleanupPeer(existing as AuthedSocket, io);
            } catch (e) {
              console.error("removeUserFromGroup (pre-emit) failed:", e);
              // You can decide to fail the join here if your policy requires it.
            }
            // Tell the old client it was replaced
            existing.emit("session:replaced", {
              roomId,
              by: "another device/session",
            });
          }

          const peers = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
            .filter((sid) => sid !== socket.id)
            .map((sid) => {
              const s = io.sockets.sockets.get(sid) as AuthedSocket | undefined;
              const u = s?.data.user || {};
              return {
                peerId: sid,
                userId: (u as AuthedUser).id,
                name: (u as AuthedUser).name ?? (u as AuthedUser).email ?? sid,
              };
            });

          const producers = Array.from(room.producers.values()).map((p) => {
            const owner = findOwnerOfProducer(io, p.id);
            return {
              id: p.id,
              producerPeerId: owner?.socketId,
              userId: owner?.user?.id,
              name: owner?.user?.name ?? owner?.user?.email ?? owner?.socketId,
              muted: !!p.paused,
            };
          });

          const dataProducers = Array.from(
            (room as any).dataProducers?.values?.() || []
          ).map((dp: any) => {
            const owner = findOwnerOfDataProducer(io, dp.id);
            return { id: dp.id, producerPeerId: owner?.socketId };
          });

          /** NEW: include current screen-share state */
          const ss = screenShareByRoom.get(roomId);
          socket.emit("roomInfo", {
            peers,
            producers,
            dataProducers,
            screenShare: ss
              ? {
                  sharerUserId: ss.userId,
                  name: ss.name || null,
                  videoProducerId: ss.videoProducerId || null,
                  audioProducerId: ss.audioProducerId || null,
                }
              : undefined,
          });

          const u = socket.data.user || {};
          socket.to(roomId).emit("peerJoined", {
            peerId: socket.id,
            userId: (u as AuthedUser).id,
            name:
              (u as AuthedUser).name ?? (u as AuthedUser).email ?? socket.id,
          });

          await joinGroupCore(prisma, {
            userId: socket.data.user!.id,
            groupId: roomId,
            name: socket.data.user!.name || "User",
          }).catch((e) => {
            console.error("Error adding user to group on joinRoom:", e);
            cb?.({ error: "Failed to join group" });
          });

          cb?.({ ok: true });
          console.log("[SRV] joinRoom ok", { roomId, sid: socket.id });
        } catch (e: any) {
          console.error("[SRV] joinRoom error", e);
          cb?.({ error: String(e?.message || e) });
        }
      }
    );

    /** Router caps */
    socket.on(
      "getRouterRtpCapabilities",
      ({ roomId }: { roomId: string }, cb: (res: any) => void) => {
        try {
          const room = getRoom(roomId);
          if (!room) return cb({ error: "room not found" });
          cb({ routerRtpCapabilities: room.getRouterRtpCapabilities() });
        } catch (e: any) {
          cb({ error: String(e?.message || e) });
        }
      }
    );

    /** Create transport */
    socket.on(
      "createWebRtcTransport",
      async (
        {
          roomId,
          direction,
          enableSctp,
        }: { roomId: string; direction: "send" | "recv"; enableSctp?: boolean },
        cb: (res: any) => void
      ) => {
        try {
          const room = getRoom(roomId);
          if (!room) return cb({ error: "room not found" });

          const params = await room.createWebRtcTransport({
            enableSctp: !!enableSctp,
          });

          if (direction === "send") socket.data.sendTransportId = params.id;
          else socket.data.recvTransportId = params.id;

          socket.data.transports ??= new Set<string>();
          socket.data.transports.add(params.id);

          console.log("[SRV] createWebRtcTransport", {
            roomId,
            direction,
            tid: params.id,
          });
          cb(params);
        } catch (e: any) {
          console.error("[SRV] createWebRtcTransport error", e);
          cb({ error: String(e?.message || e) });
        }
      }
    );

    /** Connect transport */
    socket.on(
      "connectTransport",
      async (
        {
          transportId,
          dtlsParameters,
        }: { transportId: string; dtlsParameters: any },
        cb: (res: any) => void
      ) => {
        try {
          const roomId = transportToRoom.get(transportId);
          if (!roomId) return cb({ error: "unknown transport" });
          const room = getRoom(roomId);
          if (!room) return cb({ error: "room not found" });
          await room.connectTransport(transportId, dtlsParameters);
          console.log("[SRV] connectTransport ok", { roomId, transportId });
          cb({ ok: true });
        } catch (e: any) {
          console.error("[SRV] connectTransport error", e);
          cb({ error: String(e?.message || e) });
        }
      }
    );

    /** Produce */
    socket.on(
      "produce",
      async (
        {
          transportId,
          kind,
          rtpParameters,
        }: { transportId: string; kind: "audio" | "video"; rtpParameters: any },
        cb: (res: any) => void
      ) => {
        try {
          const roomId = transportToRoom.get(transportId);
          if (!roomId) return cb({ error: "unknown transport" });
          const room = getRoom(roomId);
          if (!room) return cb({ error: "room not found" });

          const producer = await room.produce(transportId, kind, rtpParameters);
          socket.data.producers ??= new Set<string>();
          socket.data.producers.add(producer.id);

          const u = socket.data.user || {};
          socket.to(roomId).emit("newProducer", {
            producerId: producer.id,
            producerPeerId: socket.id,
            userId: (u as AuthedUser).id,
            name:
              (u as AuthedUser).name ?? (u as AuthedUser).email ?? socket.id,
            muted: !!producer.paused,
          });

          console.log(
            `[Room:${room.id}] producer created id=${producer.id} paused=${producer.paused}`
          );
          cb({ producerId: producer.id });
        } catch (e: any) {
          console.error("[SRV] produce error", e);
          cb({ error: String(e?.message || e) });
        }
      }
    );

    /** Consume */
    socket.on(
      "consume",
      async (
        {
          roomId,
          producerId,
          rtpCapabilities,
        }: { roomId: string; producerId: string; rtpCapabilities: any },
        cb: (res: any) => void
      ) => {
        try {
          const room = getRoom(roomId);
          if (!room) return cb({ error: "room not found" });

          const consumerTransportId = socket.data.recvTransportId;
          if (!consumerTransportId)
            return cb({ error: "no recv transport for this socket" });

          const data = await room.consume(
            consumerTransportId,
            producerId,
            rtpCapabilities
          );

          const consumer = (room as any).consumers?.get?.(data.id);
          if (consumer && consumer.paused) {
            try {
              await consumer.resume();
            } catch {}
          }

          console.log("[SRV] consume ok", {
            roomId,
            consumerId: data.id,
            producerId,
          });
          cb(data);
        } catch (e: any) {
          console.error("[SRV] consume error", e);
          cb({ error: String(e?.message || e) });
        }
      }
    );

    /** Producer pause/resume from mic toggle */
    socket.on(
      "producerMuted",
      async ({ muted }: { muted: boolean }, cb?: (res: any) => void) => {
        try {
          const roomId = socket.data.roomId;
          const room = roomId ? getRoom(roomId) : undefined;
          if (!room) return cb?.({ error: "room not found" });

          if (socket.data.producers) {
            const u = socket.data.user || {};
            for (const pid of socket.data.producers) {
              const p = room.producers.get(pid);
              if (!p) continue;
              if (muted && !p.paused) await p.pause();
              if (!muted && p.paused) await p.resume();
              io.to(roomId!).emit("producerMuted", {
                producerId: pid,
                peerId: socket.id,
                userId: (u as AuthedUser).id,
                muted,
              });
            }
          }
          cb?.({ ok: true });
        } catch (e: any) {
          console.error("[SRV] producerMuted error", e);
          cb?.({ error: String(e?.message || e) });
        }
      }
    );

    /** Data channel helpers (chat) */
    socket.on(
      "produceData",
      async ({ transportId, sctpStreamParameters, label, protocol }, cb) => {
        const roomId = transportToRoom.get(transportId);
        const room = getRoom(roomId!);
        const dataProducer = await (room as any).produceData(transportId, {
          sctpStreamParameters,
          label,
          protocol,
        });
        socket.data.dataProducers ??= new Set<string>();
        socket.data.dataProducers.add(dataProducer.id);
        socket.to(roomId!).emit("newDataProducer", {
          dataProducerId: dataProducer.id,
          producerPeerId: socket.id,
        });
        cb({ dataProducerId: dataProducer.id });
      }
    );

    socket.on("consumeData", async ({ roomId, dataProducerId }, cb) => {
      const room = getRoom(roomId);
      const consumerTransportId = socket.data.recvTransportId;
      const dc = await (room as any).consumeData(
        consumerTransportId!,
        dataProducerId
      );
      const dataConsumer = (room as any).dataConsumers?.get?.(dc.id);
      if (dataConsumer && (dataConsumer as any).paused) {
        try {
          await (dataConsumer as any).resume();
        } catch {}
      }
      cb(dc);
    });

    socket.on("dataConsumerResume", async ({ dataConsumerId }, cb) => {
      const room = getRoom(socket.data.roomId!);
      const dc = (room as any).dataConsumers?.get?.(dataConsumerId);
      if (dc && (dc as any).paused) {
        try {
          await (dc as any).resume();
        } catch {}
      }
      cb?.({ ok: true });
    });

    /** ---------- Screen share single-owner flow (NEW) ---------- */

    socket.on(
      "screenShare:request",
      (
        {
          roomId,
          userId,
          name,
        }: { roomId: string; userId: string; name?: string },
        cb: (res: any) => void
      ) => {
        const curr = screenShareByRoom.get(roomId);
        if (curr && curr.userId !== userId) {
          cb({ ok: false, reason: "in-use" });
          io.to(socket.id).emit("screenShare:state", {
            sharerUserId: curr.userId,
            name: curr.name || null,
          });
          return;
        }
        screenShareByRoom.set(roomId, { userId, name: name || null });
        cb({ ok: true });
        io.to(roomId).emit("screenShare:state", {
          sharerUserId: userId,
          name: name || null,
        });
      }
    );

    socket.on(
      "screenShare:bind",
      ({
        roomId,
        userId,
        videoProducerId,
        audioProducerId,
      }: {
        roomId: string;
        userId: string;
        videoProducerId?: string;
        audioProducerId?: string;
      }) => {
        const curr = screenShareByRoom.get(roomId);
        if (!curr || curr.userId !== userId) return;
        curr.videoProducerId = videoProducerId || null;
        curr.audioProducerId = audioProducerId || null;
        screenShareByRoom.set(roomId, curr);
        io.to(roomId).emit("screenShare:started", {
          sharerUserId: curr.userId,
          name: curr.name || null,
          videoProducerId: curr.videoProducerId || null,
          audioProducerId: curr.audioProducerId || null,
        });
      }
    );

    socket.on(
      "screenShare:stopped",
      ({ roomId, userId }: { roomId: string; userId: string }) => {
        const curr = screenShareByRoom.get(roomId);
        if (!curr || curr.userId !== userId) return;
        screenShareByRoom.delete(roomId);
        io.to(roomId).emit("screenShare:stopped", { sharerUserId: userId });
        io.to(roomId).emit("screenShare:state", {
          sharerUserId: null,
          name: null,
        });
      }
    );

    /** Leave & cleanup */
    socket.on("leaveRoom", async () => {
      await cleanupPeer(socket, io);
    });
    socket.on("disconnecting", async () => {
      await cleanupPeer(socket, io);
    });
    socket.on("disconnect", () => {
      console.log("[SOCKET] disconnected", socket.id);
    });
  });

  async function cleanupPeer(socket: AuthedSocket, io: IOServer) {
    console.log("[SRV] cleanupPeer", socket.id);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    socket.to(roomId).emit("peerLeft", { peerId: socket.id });

    /** If leaving user was the screen sharer, stop it */
    const ss = screenShareByRoom.get(roomId);
    if (ss && ss.userId === socket.data.user?.id) {
      screenShareByRoom.delete(roomId);
      io.to(roomId).emit("screenShare:stopped", { sharerUserId: ss.userId });
      io.to(roomId).emit("screenShare:state", {
        sharerUserId: null,
        name: null,
      });
    }

    if (socket.data.producers) {
      for (const pid of socket.data.producers) {
        try {
          await room.closeProducer(pid);
        } catch {}
        socket.to(roomId).emit("producerClosed", { producerId: pid });
      }
      socket.data.producers.clear();
    }
    if (socket.data.transports) {
      for (const tid of socket.data.transports) {
        try {
          await room.destroyTransport(tid);
        } catch {}
      }
      socket.data.transports.clear();
    }

    if (socket.data.dataProducers) {
      for (const dpid of socket.data.dataProducers) {
        try {
          await (room as any).closeDataProducer(dpid);
        } catch {}
        socket.to(roomId).emit("dataProducerClosed", { dataProducerId: dpid });
      }
      socket.data.dataProducers.clear();
    }

    try {
      await socket.leave(roomId);
    } catch {}

    const userId = socket.data.user?.id;
    if (userId) {
      await removeUserFromGroup(userId, roomId).catch((e) => {
        console.error("Error removing user from group on disconnect:", e);
      });
    }

    socket.data.roomId = undefined;
  }

  return io;
}
