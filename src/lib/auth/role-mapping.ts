import type { Role } from "@/lib/db/models";

/**
 * Keycloak group -> role, re-applied on every login. This is a
 * personal/homelab tool, so a hardcoded mapping is intentional — edit this
 * list to match your realm's group names rather than building a
 * group-mapping admin UI. Group names are matched with or without a leading
 * slash (Keycloak's "full group path" mapper includes one, "group name"
 * mappers don't).
 */
const GROUP_ROLE_MAP: Record<string, Role> = {
  "arr-admin": "admin",
  "arr-requester": "requester",
  "arr-viewer": "viewer",
};

/** Role assigned to a new user whose groups don't match anything in GROUP_ROLE_MAP. */
const FALLBACK_ROLE: Role = "viewer";

/**
 * Role implied by the user's current groups, or null if none of them match
 * GROUP_ROLE_MAP — callers use null to mean "leave their existing role
 * alone" rather than forcing a fallback on every login.
 */
export function matchRoleFromGroups(groups: string[]): Role | null {
  for (const group of groups) {
    const normalized = group.replace(/^\//, "").toLowerCase();
    const role = GROUP_ROLE_MAP[normalized];
    if (role) return role;
  }
  return null;
}

/** Role to assign a brand-new user: their matched group role, or FALLBACK_ROLE. */
export function resolveDefaultRoleFromGroups(groups: string[]): Role {
  return matchRoleFromGroups(groups) ?? FALLBACK_ROLE;
}
