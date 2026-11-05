import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull(),
  audience: text("audience").notNull(),
  competitors: text("competitors").notNull(),
  prompts: text("prompts").notNull(),
  tasks: text("tasks").notNull(),
  createdAt: text("created_at").notNull(),
  lastAuditAt: text("last_audit_at"),
});
export const audits = sqliteTable("audits", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  ownerId: text("owner_id").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
export const observations = sqliteTable("observations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  ownerId: text("owner_id").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
export const scanUsage = sqliteTable("scan_usage", {
  ownerDay: text("owner_day").primaryKey(),
  count: integer("count").notNull(),
});
