// backend/src/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import prisma from "../lib/prisma";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const SALT_ROUNDS = 10;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// signup
router.post("/signup", async (req, res) => {
  try {
    console.log(req.body);
    const { email: rawEmail, password, name } = req.body;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    // check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "email already in use" });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, password: hashed, name },
      select: {
        id: true,
        email: true,
        name: true,
        gender: true,
        createdAt: true,
      },
    });

    const token = jwt.sign({ userId: user.id, name: user.name, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // set HttpOnly cookie
    res.cookie("token", token, {
      httpOnly: true, // JS can't access
      secure: process.env.NODE_ENV === "production", 
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// signin
router.post("/signin", async (req, res) => {
  try {
    console.log("Singning in")
    const { email: rawEmail, password } = req.body;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password as string);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id, name: user.name, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // set HttpOnly cookie
    res.cookie("token", token, {
      httpOnly: true, // JS can't access
      secure: process.env.NODE_ENV === "production", // use true only in HTTPS
      sameSite: "lax", // "none" if frontend/backend on different domains + HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // return user (without password) and token
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        gender: user.gender,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// google oauth
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "Google credential required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const email = payload.email.trim().toLowerCase();
    const { name, picture } = payload;

    // find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || null,
          avatar: picture || null,
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(401).json({ error: "Google authentication failed" });
  }
});

router.post('/signout', (req, res) => {
  console.log("logging out")
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return res.json({ ok: true })
})

export default router;
