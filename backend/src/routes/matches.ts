import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /matches — list recent match history
router.get("/", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const matches = await prisma.matchHistory.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: { select: { id: true, name: true, avatar: true } },
        user2: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const list = matches.map((m) => {
      const other = m.user1Id === userId ? m.user2 : m.user1;
      return {
        id: m.id,
        partnerId: other.id,
        name: other.name,
        avatar: other.avatar,
        chatAt: m.createdAt,
      };
    });

    return res.json({ matches: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /matches — record a match (called by socket handler on match)
router.post("/", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { partnerId } = req.body;
    if (!partnerId) return res.status(400).json({ error: "partnerId required" });

    const match = await prisma.matchHistory.create({
      data: { user1Id: userId, user2Id: partnerId },
    });

    return res.status(201).json({ match });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /matches/:id — remove a match from history
router.delete("/:id", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const match = await prisma.matchHistory.findUnique({ where: { id: req.params.id } });
    if (!match || (match.user1Id !== userId && match.user2Id !== userId)) {
      return res.status(404).json({ error: "Not found" });
    }

    await prisma.matchHistory.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
