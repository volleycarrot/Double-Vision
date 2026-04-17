import { Router, type IRouter } from "express";
import { db, customMapsTable, mapLikesTable, usersTable } from "@workspace/db";
import { eq, and, desc, ilike, or, sql, count } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { authRequired, verifyToken } from "../middleware/auth";

const VALID_TILE_TYPES = new Set(["ground", "platform", "kill", "spike", "movement", "checkpoint", "cave", "secret", "finish"]);
const VALID_DIRS = new Set(["up", "down", "left", "right"]);
const MAX_TILES = 5000;

interface RawTile {
  x: unknown;
  y: unknown;
  type: unknown;
  width?: unknown;
  dir?: unknown;
}

function validateTileArray(tiles: RawTile[]): string | null {
  if (tiles.length > MAX_TILES) return `Too many tiles (max ${MAX_TILES})`;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (typeof t !== "object" || t === null) return `Tile ${i}: not an object`;
    if (typeof t.x !== "number" || !Number.isInteger(t.x) || t.x < 0 || t.x >= 50) return `Tile ${i}: invalid x`;
    if (typeof t.y !== "number" || !Number.isInteger(t.y) || t.y < 0 || t.y >= 15) return `Tile ${i}: invalid y`;
    if (typeof t.type !== "string" || !VALID_TILE_TYPES.has(t.type)) return `Tile ${i}: invalid type "${String(t.type)}"`;
    if (t.width !== undefined && (typeof t.width !== "number" || !Number.isInteger(t.width) || t.width < 1 || t.width > 50)) return `Tile ${i}: invalid width`;
    if (t.dir !== undefined && (typeof t.dir !== "string" || !VALID_DIRS.has(t.dir))) return `Tile ${i}: invalid dir`;
  }
  return null;
}

function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7);
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}

const router: IRouter = Router();

router.get("/user/maps", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const maps = await db.select({
      id: customMapsTable.id,
      name: customMapsTable.name,
      bgColor: customMapsTable.bgColor,
      groundColor: customMapsTable.groundColor,
      platformColor: customMapsTable.platformColor,
      isPublic: customMapsTable.isPublic,
      createdAt: customMapsTable.createdAt,
      updatedAt: customMapsTable.updatedAt,
    }).from(customMapsTable)
      .where(eq(customMapsTable.userId, userId))
      .orderBy(desc(customMapsTable.updatedAt));

    res.json({ maps });
  } catch (err) {
    console.error("List maps error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/user/maps/:id", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rawId = typeof req.params.id === "string" ? req.params.id : "";
    const mapId = parseInt(rawId, 10);
    if (isNaN(mapId)) {
      res.status(400).json({ error: "Invalid map ID" });
      return;
    }

    const [map] = await db.select().from(customMapsTable)
      .where(and(eq(customMapsTable.id, mapId), eq(customMapsTable.userId, userId)))
      .limit(1);

    if (!map) {
      res.status(404).json({ error: "Map not found" });
      return;
    }

    res.json({ map });
  } catch (err) {
    console.error("Get map error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/user/maps", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { name, tileData, bgColor, groundColor, platformColor, isPublic } = req.body;

    if (!name || typeof name !== "string" || name.length < 1 || name.length > 50) {
      res.status(400).json({ error: "Name must be 1-50 characters" });
      return;
    }
    if (!tileData || typeof tileData !== "string") {
      res.status(400).json({ error: "Invalid tile data" });
      return;
    }
    let parsedTiles: RawTile[];
    try {
      parsedTiles = JSON.parse(tileData);
      if (!Array.isArray(parsedTiles)) {
        res.status(400).json({ error: "Tile data must be a JSON array" });
        return;
      }
    } catch {
      res.status(400).json({ error: "Tile data must be valid JSON" });
      return;
    }
    if (tileData.length > 500000) {
      res.status(400).json({ error: "Tile data too large" });
      return;
    }
    const tileError = validateTileArray(parsedTiles);
    if (tileError) {
      res.status(400).json({ error: tileError });
      return;
    }
    if (bgColor && (typeof bgColor !== "string" || bgColor.length > 20)) {
      res.status(400).json({ error: "Invalid background color" });
      return;
    }
    if (groundColor && (typeof groundColor !== "string" || groundColor.length > 20)) {
      res.status(400).json({ error: "Invalid ground color" });
      return;
    }
    if (platformColor && (typeof platformColor !== "string" || platformColor.length > 20)) {
      res.status(400).json({ error: "Invalid platform color" });
      return;
    }

    const mapCount = await db.select({ id: customMapsTable.id }).from(customMapsTable)
      .where(eq(customMapsTable.userId, userId));
    if (mapCount.length >= 50) {
      res.status(400).json({ error: "Maximum 50 maps per user" });
      return;
    }

    const [inserted] = await db.insert(customMapsTable).values({
      userId,
      name,
      tileData,
      bgColor: bgColor || "#1a1a2e",
      groundColor: groundColor || "#3a3a3a",
      platformColor: platformColor || "#4a4a4a",
      isPublic: isPublic === true ? true : false,
    }).returning();

    res.json({ map: { id: inserted.id, name: inserted.name } });
  } catch (err) {
    console.error("Create map error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/user/maps/:id", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rawId = typeof req.params.id === "string" ? req.params.id : "";
    const mapId = parseInt(rawId, 10);
    if (isNaN(mapId)) {
      res.status(400).json({ error: "Invalid map ID" });
      return;
    }

    const [existing] = await db.select().from(customMapsTable)
      .where(and(eq(customMapsTable.id, mapId), eq(customMapsTable.userId, userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Map not found" });
      return;
    }

    const { name, tileData, bgColor, groundColor, platformColor, isPublic } = req.body;
    const updates: Partial<{ name: string; tileData: string; bgColor: string; groundColor: string; platformColor: string; isPublic: boolean; updatedAt: Date }> = { updatedAt: new Date() };

    if (name !== undefined) {
      if (typeof name !== "string" || name.length < 1 || name.length > 50) {
        res.status(400).json({ error: "Name must be 1-50 characters" });
        return;
      }
      updates.name = name;
    }
    if (tileData !== undefined) {
      if (typeof tileData !== "string") {
        res.status(400).json({ error: "Invalid tile data" });
        return;
      }
      let parsedTiles: RawTile[];
      try {
        parsedTiles = JSON.parse(tileData);
        if (!Array.isArray(parsedTiles)) {
          res.status(400).json({ error: "Tile data must be a JSON array" });
          return;
        }
      } catch {
        res.status(400).json({ error: "Tile data must be valid JSON" });
        return;
      }
      if (tileData.length > 500000) {
        res.status(400).json({ error: "Tile data too large" });
        return;
      }
      const tileError = validateTileArray(parsedTiles);
      if (tileError) {
        res.status(400).json({ error: tileError });
        return;
      }
      updates.tileData = tileData;
    }
    if (bgColor !== undefined) {
      if (typeof bgColor !== "string" || bgColor.length > 20) {
        res.status(400).json({ error: "Invalid background color" });
        return;
      }
      updates.bgColor = bgColor;
    }
    if (groundColor !== undefined) {
      if (typeof groundColor !== "string" || groundColor.length > 20) {
        res.status(400).json({ error: "Invalid ground color" });
        return;
      }
      updates.groundColor = groundColor;
    }
    if (platformColor !== undefined) {
      if (typeof platformColor !== "string" || platformColor.length > 20) {
        res.status(400).json({ error: "Invalid platform color" });
        return;
      }
      updates.platformColor = platformColor;
    }
    if (isPublic !== undefined) {
      updates.isPublic = isPublic === true;
    }

    await db.update(customMapsTable).set(updates)
      .where(and(eq(customMapsTable.id, mapId), eq(customMapsTable.userId, userId)));

    res.json({ success: true });
  } catch (err) {
    console.error("Update map error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/user/maps/:id", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rawId = typeof req.params.id === "string" ? req.params.id : "";
    const mapId = parseInt(rawId, 10);
    if (isNaN(mapId)) {
      res.status(400).json({ error: "Invalid map ID" });
      return;
    }

    const result = await db.delete(customMapsTable)
      .where(and(eq(customMapsTable.id, mapId), eq(customMapsTable.userId, userId)))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "Map not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete map error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/maps/gallery", optionalAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const likeCountSq = db
      .select({
        mapId: mapLikesTable.mapId,
        likeCount: count(mapLikesTable.id).as("like_count"),
      })
      .from(mapLikesTable)
      .groupBy(mapLikesTable.mapId)
      .as("like_counts");

    const predicate = search.length > 0
      ? and(
          eq(customMapsTable.isPublic, true),
          or(
            ilike(customMapsTable.name, `%${search}%`),
            ilike(usersTable.username, `%${search}%`)
          )
        )
      : eq(customMapsTable.isPublic, true);

    const maps = await db
      .select({
        id: customMapsTable.id,
        name: customMapsTable.name,
        bgColor: customMapsTable.bgColor,
        groundColor: customMapsTable.groundColor,
        platformColor: customMapsTable.platformColor,
        createdAt: customMapsTable.createdAt,
        updatedAt: customMapsTable.updatedAt,
        creatorUsername: usersTable.username,
        likeCount: sql<number>`coalesce(${likeCountSq.likeCount}, 0)`,
      })
      .from(customMapsTable)
      .innerJoin(usersTable, eq(customMapsTable.userId, usersTable.id))
      .leftJoin(likeCountSq, eq(customMapsTable.id, likeCountSq.mapId))
      .where(predicate)
      .orderBy(
        desc(sql`coalesce(${likeCountSq.likeCount}, 0)`),
        desc(customMapsTable.updatedAt)
      )
      .limit(100);

    let likedMapIds: Set<number> = new Set();
    if (req.user) {
      const likes = await db
        .select({ mapId: mapLikesTable.mapId })
        .from(mapLikesTable)
        .where(eq(mapLikesTable.userId, req.user.userId));
      likedMapIds = new Set(likes.map(l => l.mapId));
    }

    const result = maps.map(m => ({
      ...m,
      likeCount: Number(m.likeCount),
      likedByMe: likedMapIds.has(m.id),
    }));

    res.json({ maps: result });
  } catch (err) {
    console.error("Gallery error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/maps/public/:id", optionalAuth, async (req, res) => {
  try {
    const rawId = typeof req.params.id === "string" ? req.params.id : "";
    const mapId = parseInt(rawId, 10);
    if (isNaN(mapId)) {
      res.status(400).json({ error: "Invalid map ID" });
      return;
    }

    const [map] = await db.select().from(customMapsTable)
      .where(and(eq(customMapsTable.id, mapId), eq(customMapsTable.isPublic, true)))
      .limit(1);

    if (!map) {
      res.status(404).json({ error: "Map not found or not public" });
      return;
    }

    res.json({ map });
  } catch (err) {
    console.error("Get public map error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/maps/:id/like", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rawId = typeof req.params.id === "string" ? req.params.id : "";
    const mapId = parseInt(rawId, 10);
    if (isNaN(mapId)) {
      res.status(400).json({ error: "Invalid map ID" });
      return;
    }

    const [map] = await db.select({ id: customMapsTable.id })
      .from(customMapsTable)
      .where(and(eq(customMapsTable.id, mapId), eq(customMapsTable.isPublic, true)))
      .limit(1);

    if (!map) {
      res.status(404).json({ error: "Map not found or not public" });
      return;
    }

    try {
      await db.insert(mapLikesTable).values({ userId, mapId });
    } catch {
      // unique constraint violation means already liked, that's fine
    }

    const [{ likeCount }] = await db
      .select({ likeCount: count(mapLikesTable.id) })
      .from(mapLikesTable)
      .where(eq(mapLikesTable.mapId, mapId));

    res.json({ likeCount: Number(likeCount), likedByMe: true });
  } catch (err) {
    console.error("Like map error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/maps/:id/like", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rawId = typeof req.params.id === "string" ? req.params.id : "";
    const mapId = parseInt(rawId, 10);
    if (isNaN(mapId)) {
      res.status(400).json({ error: "Invalid map ID" });
      return;
    }

    const [map] = await db.select({ id: customMapsTable.id })
      .from(customMapsTable)
      .where(and(eq(customMapsTable.id, mapId), eq(customMapsTable.isPublic, true)))
      .limit(1);

    if (!map) {
      res.status(404).json({ error: "Map not found or not public" });
      return;
    }

    await db.delete(mapLikesTable)
      .where(and(eq(mapLikesTable.userId, userId), eq(mapLikesTable.mapId, mapId)));

    const [{ likeCount }] = await db
      .select({ likeCount: count(mapLikesTable.id) })
      .from(mapLikesTable)
      .where(eq(mapLikesTable.mapId, mapId));

    res.json({ likeCount: Number(likeCount), likedByMe: false });
  } catch (err) {
    console.error("Unlike map error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
