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

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type UserProgress = typeof userProgressTable.$inferSelect;
export type UserAccessory = typeof userAccessoriesTable.$inferSelect;
