import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, authRequired } from "../middleware/auth";

const BLOCKED_WORDS = [
  "fuck", "shit", "ass", "damn", "bitch", "bastard", "dick", "cock",
  "pussy", "cunt", "whore", "slut", "fag", "faggot", "nigger", "nigga",
  "retard", "rape", "nazi", "hitler", "penis", "vagina", "anus",
  "dildo", "porn", "sex", "cum", "jizz", "tits", "boob", "wank",
  "twat", "prick", "homo", "dyke", "kike", "spic", "chink", "gook",
  "cracker", "wetback", "beaner", "tranny", "pedo", "molest", "kill",
  "murder", "suicide", "terrorist", "jihad",
];

function isInappropriateUsername(name: string): boolean {
  const lower = name.toLowerCase();
  return BLOCKED_WORDS.some(word => lower.includes(word));
}

const router: IRouter = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }
    if (typeof username !== "string") {
      res.status(400).json({ error: "Username must be a string" });
      return;
    }
    if (username.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters" });
      return;
    }
    if (username.length > 15) {
      res.status(400).json({ error: "Username must be at most 15 characters" });
      return;
    }
    if (typeof password !== "string") {
      res.status(400).json({ error: "Password must be a string" });
      return;
    }
    if (password.length < 7) {
      res.status(400).json({ error: "Password must be at least 7 characters" });
      return;
    }
    if (isInappropriateUsername(username)) {
      res.status(400).json({ error: "That username is not allowed. Please choose a different one." });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      username: username.toLowerCase(),
      passwordHash,
      coins: 0,
    }).returning();

    const token = signToken({ userId: user.id, username: user.username });
    res.status(201).json({ token, username: user.username });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/auth/me", authRequired, (req, res) => {
  res.json({ userId: req.user!.userId, username: req.user!.username });
});

export default router;
