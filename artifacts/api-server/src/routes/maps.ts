import { Router, type IRouter } from "express";
import { db, customMapsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authRequired } from "../middleware/auth";

const VALID_TILE_TYPES = new Set(["ground", "platform", "kill", "spike", "movement", "checkpoint", "cave", "secret"]);
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
    const { name, tileData, bgColor, groundColor, platformColor } = req.body;

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

    const { name, tileData, bgColor, groundColor, platformColor } = req.body;
    const updates: Partial<{ name: string; tileData: string; bgColor: string; groundColor: string; platformColor: string; updatedAt: Date }> = { updatedAt: new Date() };

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

export default router;
