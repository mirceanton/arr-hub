import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "./client";
import {
  ROLES,
  type PermissionAction,
  type RequestRecord,
  type RequestStatus,
  type Role,
  type ServiceEventRecord,
  type ServicePermissionOverride,
  type SessionRecord,
  type UserRecord,
  type UserWithRoles,
} from "./models";

/**
 * Both `db` and `schema` are dialect-typed (sqlite XOR postgres) at the
 * `client.ts` boundary, but every table below has an identical column shape
 * across both schema modules, and the drizzle-orm query builder chain
 * (`select().from().where()`, `insert().values()`, ...) is the same fluent
 * API for both drivers. Rather than maintaining two full copies of every
 * query in this file, we widen to `any` at this single seam so the rest of
 * the app can depend on one strongly-typed repository regardless of which
 * database is active.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- deliberate single seam, see comment above */
const anyDb = db as any;
const s = schema as any;

function toRequestRecord(row: any): RequestRecord {
  return {
    id: row.id,
    userId: row.userId,
    service: row.service,
    externalId: row.externalId,
    title: row.title,
    mediaType: row.mediaType,
    status: row.status as RequestStatus,
    requestedAt: new Date(row.requestedAt),
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt ? new Date(row.decidedAt) : null,
  };
}

function toUserRecord(row: any): UserRecord {
  return {
    id: row.id,
    oidcSubject: row.oidcSubject,
    email: row.email,
    displayName: row.displayName,
    createdAt: new Date(row.createdAt),
    lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
  };
}

function toServiceEventRecord(row: any): ServiceEventRecord {
  return {
    id: row.id,
    service: row.service,
    eventType: row.eventType,
    rawPayload: row.rawPayload,
    receivedAt: new Date(row.receivedAt),
  };
}

// ---- Roles -----------------------------------------------------------

/** Idempotently seeds the admin/requester/viewer roles. Call once at boot. */
export async function ensureRolesSeeded(): Promise<void> {
  const existing = await anyDb.select().from(s.roles);
  const existingNames = new Set(existing.map((r: any) => r.name));
  const missing = ROLES.filter((name) => !existingNames.has(name));
  if (missing.length === 0) return;
  await anyDb.insert(s.roles).values(missing.map((name) => ({ id: randomUUID(), name })));
}

async function getRoleIdByName(name: Role): Promise<string> {
  const [row] = await anyDb.select().from(s.roles).where(eq(s.roles.name, name)).limit(1);
  if (!row) throw new Error(`Role "${name}" is not seeded — call ensureRolesSeeded() at boot`);
  return row.id;
}

// ---- Users -------------------------------------------------------------

export async function findUserByOidcSubject(oidcSubject: string): Promise<UserRecord | null> {
  const [row] = await anyDb
    .select()
    .from(s.users)
    .where(eq(s.users.oidcSubject, oidcSubject))
    .limit(1);
  return row ? toUserRecord(row) : null;
}

export async function createUser(input: {
  oidcSubject: string;
  email: string;
  displayName: string;
}): Promise<UserRecord> {
  const now = new Date();
  const [row] = await anyDb
    .insert(s.users)
    .values({
      id: randomUUID(),
      oidcSubject: input.oidcSubject,
      email: input.email,
      displayName: input.displayName,
      createdAt: now,
      lastLoginAt: now,
    })
    .returning();
  return toUserRecord(row);
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const [row] = await anyDb.select().from(s.users).where(eq(s.users.id, id)).limit(1);
  return row ? toUserRecord(row) : null;
}

export async function touchLastLogin(userId: string): Promise<void> {
  await anyDb.update(s.users).set({ lastLoginAt: new Date() }).where(eq(s.users.id, userId));
}

export async function getUserRoles(userId: string): Promise<Role[]> {
  const rows = await anyDb
    .select({ name: s.roles.name })
    .from(s.userRoles)
    .innerJoin(s.roles, eq(s.userRoles.roleId, s.roles.id))
    .where(eq(s.userRoles.userId, userId));
  return rows.map((r: any) => r.name as Role);
}

/** Replaces every role assignment for a user with a single role (this app's roles are global, not additive). */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  const roleId = await getRoleIdByName(role);
  await anyDb.delete(s.userRoles).where(eq(s.userRoles.userId, userId));
  await anyDb.insert(s.userRoles).values({ id: randomUUID(), userId, roleId });
}

export async function listUsersWithRoles(): Promise<UserWithRoles[]> {
  const users = await anyDb.select().from(s.users);
  const roleRows = await anyDb
    .select({ userId: s.userRoles.userId, name: s.roles.name })
    .from(s.userRoles)
    .innerJoin(s.roles, eq(s.userRoles.roleId, s.roles.id));
  const rolesByUser = new Map<string, Role[]>();
  for (const r of roleRows) {
    const list = rolesByUser.get(r.userId) ?? [];
    list.push(r.name as Role);
    rolesByUser.set(r.userId, list);
  }
  return users.map((u: any) => ({ ...toUserRecord(u), roles: rolesByUser.get(u.id) ?? [] }));
}

// ---- Service permission overrides --------------------------------------

export async function listServicePermissionOverrides(
  userId: string,
): Promise<ServicePermissionOverride[]> {
  const rows = await anyDb
    .select()
    .from(s.servicePermissions)
    .where(eq(s.servicePermissions.userId, userId));
  return rows;
}

export async function getServicePermissionOverride(
  userId: string,
  service: string,
  action: PermissionAction,
): Promise<boolean | null> {
  const [row] = await anyDb
    .select({ granted: s.servicePermissions.granted })
    .from(s.servicePermissions)
    .where(
      and(
        eq(s.servicePermissions.userId, userId),
        eq(s.servicePermissions.service, service),
        eq(s.servicePermissions.action, action),
      ),
    )
    .limit(1);
  return row ? Boolean(row.granted) : null;
}

export async function deleteServicePermissionOverride(
  userId: string,
  service: string,
  action: PermissionAction,
): Promise<void> {
  await anyDb
    .delete(s.servicePermissions)
    .where(
      and(
        eq(s.servicePermissions.userId, userId),
        eq(s.servicePermissions.service, service),
        eq(s.servicePermissions.action, action),
      ),
    );
}

export async function setServicePermissionOverride(
  userId: string,
  service: string,
  action: PermissionAction,
  granted: boolean,
): Promise<void> {
  await anyDb
    .insert(s.servicePermissions)
    .values({ id: randomUUID(), userId, service, action, granted })
    .onConflictDoUpdate({
      target: [s.servicePermissions.userId, s.servicePermissions.service, s.servicePermissions.action],
      set: { granted },
    });
}

// ---- Requests ------------------------------------------------------------

export async function createRequest(input: {
  userId: string;
  service: string;
  externalId: string;
  title: string;
  mediaType: string;
}): Promise<RequestRecord> {
  const [row] = await anyDb
    .insert(s.requests)
    .values({
      id: randomUUID(),
      userId: input.userId,
      service: input.service,
      externalId: input.externalId,
      title: input.title,
      mediaType: input.mediaType,
      status: "pending" satisfies RequestStatus,
      requestedAt: new Date(),
      decidedBy: null,
      decidedAt: null,
    })
    .returning();
  return toRequestRecord(row);
}

export async function listRequestsByUser(userId: string): Promise<RequestRecord[]> {
  const rows = await anyDb
    .select()
    .from(s.requests)
    .where(eq(s.requests.userId, userId))
    .orderBy(desc(s.requests.requestedAt));
  return rows.map(toRequestRecord);
}

export async function listPendingRequests(services: string[]): Promise<RequestRecord[]> {
  if (services.length === 0) return [];
  const rows = await anyDb
    .select()
    .from(s.requests)
    .where(and(eq(s.requests.status, "pending" satisfies RequestStatus), inArray(s.requests.service, services)))
    .orderBy(desc(s.requests.requestedAt));
  return rows.map(toRequestRecord);
}

export interface PendingRequestWithRequester extends RequestRecord {
  requesterName: string;
}

/** Same as {@link listPendingRequests}, plus the requesting user's display name for the admin queue UI. */
export async function listPendingRequestsWithRequester(
  services: string[],
): Promise<PendingRequestWithRequester[]> {
  if (services.length === 0) return [];
  const rows = await anyDb
    .select({
      id: s.requests.id,
      userId: s.requests.userId,
      service: s.requests.service,
      externalId: s.requests.externalId,
      title: s.requests.title,
      mediaType: s.requests.mediaType,
      status: s.requests.status,
      requestedAt: s.requests.requestedAt,
      decidedBy: s.requests.decidedBy,
      decidedAt: s.requests.decidedAt,
      requesterName: s.users.displayName,
    })
    .from(s.requests)
    .innerJoin(s.users, eq(s.requests.userId, s.users.id))
    .where(and(eq(s.requests.status, "pending" satisfies RequestStatus), inArray(s.requests.service, services)))
    .orderBy(desc(s.requests.requestedAt));
  return rows.map((row: any) => ({ ...toRequestRecord(row), requesterName: row.requesterName }));
}

export async function listRecentRequests(services: string[], limit: number): Promise<RequestRecord[]> {
  if (services.length === 0) return [];
  const rows = await anyDb
    .select()
    .from(s.requests)
    .where(inArray(s.requests.service, services))
    .orderBy(desc(s.requests.requestedAt))
    .limit(limit);
  return rows.map(toRequestRecord);
}

export async function getRequestById(id: string): Promise<RequestRecord | null> {
  const [row] = await anyDb.select().from(s.requests).where(eq(s.requests.id, id)).limit(1);
  return row ? toRequestRecord(row) : null;
}

export async function decideRequest(
  id: string,
  input: { status: Extract<RequestStatus, "approved" | "rejected">; decidedBy: string },
): Promise<RequestRecord | null> {
  const [row] = await anyDb
    .update(s.requests)
    .set({ status: input.status, decidedBy: input.decidedBy, decidedAt: new Date() })
    .where(eq(s.requests.id, id))
    .returning();
  return row ? toRequestRecord(row) : null;
}

/** Finds an approved request awaiting fulfillment for a given service+external id, used by the webhook handler. */
export async function findApprovedRequest(
  service: string,
  externalId: string,
): Promise<RequestRecord | null> {
  const [row] = await anyDb
    .select()
    .from(s.requests)
    .where(
      and(
        eq(s.requests.service, service),
        eq(s.requests.externalId, externalId),
        eq(s.requests.status, "approved" satisfies RequestStatus),
      ),
    )
    .limit(1);
  return row ? toRequestRecord(row) : null;
}

export async function deleteRequest(id: string): Promise<void> {
  await anyDb.delete(s.requests).where(eq(s.requests.id, id));
}

export async function markRequestFulfilled(id: string): Promise<void> {
  await anyDb
    .update(s.requests)
    .set({ status: "fulfilled" satisfies RequestStatus })
    .where(eq(s.requests.id, id));
}

// ---- Service events (webhook activity feed) -------------------------------

export async function createServiceEvent(input: {
  service: string;
  eventType: string;
  rawPayload: string;
}): Promise<ServiceEventRecord> {
  const [row] = await anyDb
    .insert(s.serviceEvents)
    .values({ id: randomUUID(), ...input, receivedAt: new Date() })
    .returning();
  return toServiceEventRecord(row);
}

export async function listRecentServiceEvents(
  services: string[],
  limit: number,
): Promise<ServiceEventRecord[]> {
  if (services.length === 0) return [];
  const rows = await anyDb
    .select()
    .from(s.serviceEvents)
    .where(inArray(s.serviceEvents.service, services))
    .orderBy(desc(s.serviceEvents.receivedAt))
    .limit(limit);
  return rows.map(toServiceEventRecord);
}

// ---- Sessions --------------------------------------------------------------

export async function createSession(userId: string, expiresAt: Date): Promise<string> {
  const id = randomUUID();
  await anyDb.insert(s.sessions).values({ id, userId, expiresAt, createdAt: new Date() });
  return id;
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const [row] = await anyDb.select().from(s.sessions).where(eq(s.sessions.id, sessionId)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    expiresAt: new Date(row.expiresAt),
    createdAt: new Date(row.createdAt),
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await anyDb.delete(s.sessions).where(eq(s.sessions.id, sessionId));
}
