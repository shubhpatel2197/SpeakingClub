import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /friends — list accepted friends
router.get("/", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const friends = await prisma.friend.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ fromId: userId }, { toId: userId }],
      },
      include: {
        from: { select: { id: true, name: true, avatar: true } },
        to: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Return the "other" user for each friendship
    const list = friends.map((f) => {
      const other = f.fromId === userId ? f.to : f.from;
      return { id: f.id, friendId: other.id, name: other.name, avatar: other.avatar, since: f.createdAt };
    });

    return res.json({ friends: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /friends/requests/count — pending incoming request count (for polling)
router.get("/requests/count", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const count = await prisma.friend.count({
      where: { toId: userId, status: "PENDING" },
    });

    return res.json({ count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /friends/requests — list pending incoming requests
router.get("/requests", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const requests = await prisma.friend.findMany({
      where: { toId: userId, status: "PENDING" },
      include: {
        from: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      requests: requests.map((r) => ({
        id: r.id,
        fromId: r.from.id,
        name: r.from.name,
        avatar: r.from.avatar,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /friends/sent — list outgoing pending requests (IDs of users I sent to)
router.get("/sent", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const sent = await prisma.friend.findMany({
      where: { fromId: userId, status: "PENDING" },
      select: { toId: true },
    });

    return res.json({ sent: sent.map((s) => s.toId) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /friends/send — send friend request
router.post("/send", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { toId } = req.body;
    if (!toId) return res.status(400).json({ error: "toId required" });
    if (toId === userId) return res.status(400).json({ error: "Cannot friend yourself" });

    // Check if a friendship already exists in either direction
    const existing = await prisma.friend.findFirst({
      where: {
        OR: [
          { fromId: userId, toId },
          { fromId: toId, toId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === "ACCEPTED") {
        return res.status(409).json({ error: "Already friends" });
      }
      if (existing.status === "PENDING") {
        // If the other person already sent us a request, auto-accept
        if (existing.fromId === toId) {
          const updated = await prisma.friend.update({
            where: { id: existing.id },
            data: { status: "ACCEPTED" },
          });
          return res.json({ friend: updated, autoAccepted: true });
        }
        return res.status(409).json({ error: "Request already sent" });
      }
    }

    const friend = await prisma.friend.create({
      data: { fromId: userId, toId },
    });

    return res.status(201).json({ friend });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /friends/accept — accept a friend request
router.post("/accept", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: "requestId required" });

    const request = await prisma.friend.findUnique({ where: { id: requestId } });
    if (!request || request.toId !== userId) {
      return res.status(404).json({ error: "Request not found" });
    }
    if (request.status !== "PENDING") {
      return res.status(400).json({ error: "Request already handled" });
    }

    const updated = await prisma.friend.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
    });

    return res.json({ friend: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /friends/by-user/:userId — unfriend by partner user id
router.delete("/by-user/:userId", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const otherId = req.params.userId;
    const friend = await prisma.friend.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { fromId: userId, toId: otherId },
          { fromId: otherId, toId: userId },
        ],
      },
    });
    if (!friend) return res.status(404).json({ error: "Not found" });

    await prisma.friend.delete({ where: { id: friend.id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /friends/:id — remove friend or reject request
router.delete("/:id", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const friend = await prisma.friend.findUnique({ where: { id: req.params.id } });
    if (!friend || (friend.fromId !== userId && friend.toId !== userId)) {
      return res.status(404).json({ error: "Not found" });
    }

    await prisma.friend.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
