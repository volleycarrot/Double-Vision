import { Router, type IRouter } from "express";
import { db, usersTable, userProgressTable, userAccessoriesTable, userStatsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authRequired } from "../middleware/auth";

const router: IRouter = Router();

router.get("/user/data", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const progress = await db.select().from(userProgressTable).where(eq(userProgressTable.userId, userId));
    const accessories = await db.select().from(userAccessoriesTable).where(eq(userAccessoriesTable.userId, userId));

    const [userStatsRow] = await db.select().from(userStatsTable).where(eq(userStatsTable.userId, userId)).limit(1);

    res.json({
      coins: user.coins,
      progress: progress.map(p => ({
        worldIndex: p.worldIndex,
        completed: p.completed,
        deaths: p.deaths,
        deathless: p.deathless,
      })),
      accessories: accessories.map(a => ({
        accessoryId: a.accessoryId,
        equipped: a.equipped,
      })),
      stats: userStatsRow ? {
        totalCoinsEarned: userStatsRow.totalCoinsEarned,
        totalCoinsSpent: userStatsRow.totalCoinsSpent,
        totalDeaths: userStatsRow.totalDeaths,
        totalLevelCompletions: userStatsRow.totalLevelCompletions,
        totalLevelsCreated: userStatsRow.totalLevelsCreated,
      } : null,
    });
  } catch (err) {
    console.error("Get user data error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/user/coins", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { coins } = req.body;
    if (typeof coins !== "number" || !Number.isInteger(coins) || coins < 0 || coins > 999999) {
      res.status(400).json({ error: "Invalid coin value" });
      return;
    }

    await db.update(usersTable).set({ coins, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ coins });
  } catch (err) {
    console.error("Update coins error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/user/progress", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { worldIndex, completed, deaths, deathless } = req.body;
    if (typeof worldIndex !== "number" || !Number.isInteger(worldIndex) || worldIndex < 0 || worldIndex > 9) {
      res.status(400).json({ error: "Invalid world index" });
      return;
    }
    if (completed !== undefined && typeof completed !== "boolean") {
      res.status(400).json({ error: "completed must be a boolean" });
      return;
    }
    if (deaths !== undefined && (typeof deaths !== "number" || !Number.isInteger(deaths) || deaths < 0)) {
      res.status(400).json({ error: "deaths must be a non-negative integer" });
      return;
    }
    if (deathless !== undefined && typeof deathless !== "boolean") {
      res.status(400).json({ error: "deathless must be a boolean" });
      return;
    }

    const existing = await db.select().from(userProgressTable)
      .where(and(eq(userProgressTable.userId, userId), eq(userProgressTable.worldIndex, worldIndex)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(userProgressTable)
        .set({
          completed: completed ?? existing[0].completed,
          deaths: deaths ?? existing[0].deaths,
          deathless: deathless === undefined ? existing[0].deathless : deathless,
        })
        .where(and(eq(userProgressTable.userId, userId), eq(userProgressTable.worldIndex, worldIndex)));
    } else {
      await db.insert(userProgressTable).values({
        userId,
        worldIndex,
        completed: completed ?? false,
        deaths: deaths ?? 0,
        deathless: deathless === true,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Update progress error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/user/accessories", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { owned, equipped } = req.body;

    if (!Array.isArray(owned) || !owned.every((id: any) => typeof id === "string" && id.length > 0 && id.length <= 50)) {
      res.status(400).json({ error: "owned must be an array of valid accessory ID strings" });
      return;
    }
    if (owned.length > 100) {
      res.status(400).json({ error: "Too many accessories" });
      return;
    }

    const uniqueOwned = [...new Set(owned as string[])];

    if (uniqueOwned.length > 0) {
      const equippedMap: Record<string, boolean> = equipped || {};
      const values = uniqueOwned.map((accId: string) => ({
        userId,
        accessoryId: accId,
        equipped: !!equippedMap[accId],
      }));
      await db
        .insert(userAccessoriesTable)
        .values(values)
        .onConflictDoUpdate({
          target: [userAccessoriesTable.userId, userAccessoriesTable.accessoryId],
          set: { equipped: sql`excluded.equipped` },
        });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Update accessories error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/user/stats", authRequired, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { totalCoinsEarned, totalCoinsSpent, totalDeaths, totalLevelCompletions, totalLevelsCreated } = req.body;

    const fields = { totalCoinsEarned, totalCoinsSpent, totalDeaths, totalLevelCompletions, totalLevelsCreated };
    for (const [key, val] of Object.entries(fields)) {
      if (typeof val !== "number" || !Number.isInteger(val) || val < 0 || val > 99999999) {
        res.status(400).json({ error: `Invalid value for ${key}` });
        return;
      }
    }

    const existing = await db.select().from(userStatsTable)
      .where(eq(userStatsTable.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(userStatsTable)
        .set({
          totalCoinsEarned: sql`GREATEST(${userStatsTable.totalCoinsEarned}, ${totalCoinsEarned})`,
          totalCoinsSpent: sql`GREATEST(${userStatsTable.totalCoinsSpent}, ${totalCoinsSpent})`,
          totalDeaths: sql`GREATEST(${userStatsTable.totalDeaths}, ${totalDeaths})`,
          totalLevelCompletions: sql`GREATEST(${userStatsTable.totalLevelCompletions}, ${totalLevelCompletions})`,
          totalLevelsCreated: sql`GREATEST(${userStatsTable.totalLevelsCreated}, ${totalLevelsCreated})`,
        })
        .where(eq(userStatsTable.userId, userId));
    } else {
      await db.insert(userStatsTable).values({
        userId,
        totalCoinsEarned,
        totalCoinsSpent,
        totalDeaths,
        totalLevelCompletions,
        totalLevelsCreated,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Update stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
