import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  coins: integer("coins").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userProgressTable = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  worldIndex: integer("world_index").notNull(),
  completed: boolean("completed").notNull().default(false),
  deaths: integer("deaths").notNull().default(0),
  deathless: boolean("deathless").notNull().default(false),
}, (table) => [
  uniqueIndex("user_progress_user_world_idx").on(table.userId, table.worldIndex),
]);

export const userAccessoriesTable = pgTable("user_accessories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  accessoryId: text("accessory_id").notNull(),
  equipped: boolean("equipped").notNull().default(false),
}, (table) => [
  uniqueIndex("user_accessories_user_acc_idx").on(table.userId, table.accessoryId),
]);

export const userStatsTable = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  totalCoinsEarned: integer("total_coins_earned").notNull().default(0),
  totalCoinsSpent: integer("total_coins_spent").notNull().default(0),
  totalDeaths: integer("total_deaths").notNull().default(0),
  totalLevelCompletions: integer("total_level_completions").notNull().default(0),
  totalLevelsCreated: integer("total_levels_created").notNull().default(0),
});

export const customMapsTable = pgTable("custom_maps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  tileData: text("tile_data").notNull(),
  bgColor: text("bg_color").notNull().default("#1a1a2e"),
  groundColor: text("ground_color").notNull().default("#3a3a3a"),
  platformColor: text("platform_color").notNull().default("#4a4a4a"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type UserProgress = typeof userProgressTable.$inferSelect;
export type UserAccessory = typeof userAccessoriesTable.$inferSelect;
export type UserStats = typeof userStatsTable.$inferSelect;
export type CustomMap = typeof customMapsTable.$inferSelect;
