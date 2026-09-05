import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  oidcSubject: text("oidc_subject").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  /** null = inherit the app_settings global default; true/false = explicit per-user override. */
  autoApprove: integer("auto_approve", { mode: "boolean" }),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("user_roles_user_role_idx").on(table.userId, table.roleId)],
);

export const servicePermissions = sqliteTable(
  "service_permissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    action: text("action").notNull(),
    granted: integer("granted", { mode: "boolean" }).notNull(),
  },
  (table) => [
    uniqueIndex("service_permissions_user_service_action_idx").on(
      table.userId,
      table.service,
      table.action,
    ),
  ],
);

export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  service: text("service").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  mediaType: text("media_type").notNull(),
  status: text("status").notNull(),
  requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
  decidedBy: text("decided_by").references(() => users.id),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  /** JSON-serialized RequestSelection (e.g. {"seasonNumbers":[1,2]}), or null for "everything". */
  selection: text("selection"),
});

export const serviceEvents = sqliteTable("service_events", {
  id: text("id").primaryKey(),
  service: text("service").notNull(),
  eventType: text("event_type").notNull(),
  rawPayload: text("raw_payload").notNull(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
