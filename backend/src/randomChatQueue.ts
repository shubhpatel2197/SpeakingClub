import crypto from "crypto";

export type QueueEntry = {
  socketId: string;
  userId: string;
  name: string;
  joinedAt: number;
};

type ActiveSession = {
  userA: { socketId: string; userId: string; name: string };
  userB: { socketId: string; userId: string; name: string };
};

/** Waiting queue – first-come-first-matched */
const queue: QueueEntry[] = [];

/** roomId → session with both participants */
const activeSessions = new Map<string, ActiveSession>();

/** userId → roomId they are currently in */
const userToRoom = new Map<string, string>();

// ──────────────────────────────────────────────

export function enqueue(
  entry: QueueEntry
):
  | { matched: true; roomId: string; partner: QueueEntry }
  | { matched: false } {
  // Remove any stale entry for the same user (e.g. reconnect)
  dequeueByUserId(entry.userId);

  // Try to find a match (someone who isn't the same user)
  const idx = queue.findIndex((e) => e.userId !== entry.userId);

  if (idx !== -1) {
    const partner = queue.splice(idx, 1)[0];
    const roomId = `randomchat:${crypto.randomUUID()}`;

    activeSessions.set(roomId, {
      userA: { socketId: entry.socketId, userId: entry.userId, name: entry.name },
      userB: { socketId: partner.socketId, userId: partner.userId, name: partner.name },
    });
    userToRoom.set(entry.userId, roomId);
    userToRoom.set(partner.userId, roomId);

    return { matched: true, roomId, partner };
  }

  // No match available – add to queue
  queue.push(entry);
  return { matched: false };
}

export function dequeue(socketId: string): void {
  const idx = queue.findIndex((e) => e.socketId === socketId);
  if (idx !== -1) queue.splice(idx, 1);
}

export function dequeueByUserId(userId: string): void {
  const idx = queue.findIndex((e) => e.userId === userId);
  if (idx !== -1) queue.splice(idx, 1);
}

export function isUserInQueue(userId: string): boolean {
  return queue.some((e) => e.userId === userId);
}

export function getUserSession(userId: string): string | undefined {
  return userToRoom.get(userId);
}

export function getSession(roomId: string): ActiveSession | undefined {
  return activeSessions.get(roomId);
}

/** End a random-chat session. Returns the session that was removed. */
export function endSession(roomId: string): ActiveSession | undefined {
  const session = activeSessions.get(roomId);
  if (!session) return undefined;

  userToRoom.delete(session.userA.userId);
  userToRoom.delete(session.userB.userId);
  activeSessions.delete(roomId);

  return session;
}

/** Get the partner's socketId for a given userId in a session. */
export function getPartnerSocketId(
  roomId: string,
  userId: string
): string | undefined {
  const session = activeSessions.get(roomId);
  if (!session) return undefined;
  if (session.userA.userId === userId) return session.userB.socketId;
  if (session.userB.userId === userId) return session.userA.socketId;
  return undefined;
}

export function getPartnerName(
  roomId: string,
  userId: string
): string | undefined {
  const session = activeSessions.get(roomId);
  if (!session) return undefined;
  if (session.userA.userId === userId) return session.userB.name;
  if (session.userB.userId === userId) return session.userA.name;
  return undefined;
}

/** Update a user's socketId in the active session (for reconnects). */
export function updateSocketId(userId: string, newSocketId: string): void {
  const roomId = userToRoom.get(userId);
  if (!roomId) return;
  const session = activeSessions.get(roomId);
  if (!session) return;
  if (session.userA.userId === userId) session.userA.socketId = newSocketId;
  if (session.userB.userId === userId) session.userB.socketId = newSocketId;

  // Also update in queue if present
  const qe = queue.find((e) => e.userId === userId);
  if (qe) qe.socketId = newSocketId;
}

export function getQueueSize(): number {
  return queue.length;
}
