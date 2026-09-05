import type { ServiceId } from "@/env";

export const ROLES = ["admin", "requester", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSION_ACTIONS = ["view", "request", "manage"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "fulfilled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface UserRecord {
  id: string;
  oidcSubject: string;
  email: string;
  displayName: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  /** null = inherit the global auto-approve default; true/false = explicit per-user override. */
  autoApprove: boolean | null;
}

export interface UserWithRoles extends UserRecord {
  roles: Role[];
}

export interface ServicePermissionOverride {
  id: string;
  userId: string;
  service: ServiceId | string;
  action: PermissionAction;
  granted: boolean;
}

export interface RequestRecord {
  id: string;
  userId: string;
  service: ServiceId | string;
  externalId: string;
  title: string;
  mediaType: string;
  status: RequestStatus;
  requestedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
}

export interface ServiceEventRecord {
  id: string;
  service: ServiceId | string;
  eventType: string;
  rawPayload: string;
  receivedAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}
