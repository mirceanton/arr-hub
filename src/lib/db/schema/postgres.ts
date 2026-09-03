import { pgTable, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  oidcSubject: text("oidc_subject").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
});

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const userRoles = pgTable(
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

export const servicePermissions = pgTable(
  "service_permissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    action: text("action").notNull(),
    granted: boolean("granted").notNull(),
  },
  (table) => [
    uniqueIndex("service_permissions_user_service_action_idx").on(
      table.userId,
      table.service,
      table.action,
    ),
  ],
);

export const requests = pgTable("requests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  service: text("service").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  mediaType: text("media_type").notNull(),
  status: text("status").notNull(),
  requestedAt: timestamp("requested_at", { mode: "date" }).notNull(),
  decidedBy: text("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { mode: "date" }),
});

export const serviceEvents = pgTable("service_events", {
  id: text("id").primaryKey(),
  service: text("service").notNull(),
  eventType: text("event_type").notNull(),
  rawPayload: text("raw_payload").notNull(),
  receivedAt: timestamp("received_at", { mode: "date" }).notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});
