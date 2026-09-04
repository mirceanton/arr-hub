import type { Role } from "@/lib/db/models";

/**
 * Keycloak group -> default role, applied once at a new user's first login.
 * This is a personal/homelab tool, so a hardcoded mapping is intentional —
 * edit this list to match your realm's group names rather than building a
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

export function resolveDefaultRoleFromGroups(groups: string[]): Role {
  for (const group of groups) {
    const normalized = group.replace(/^\//, "").toLowerCase();
    const role = GROUP_ROLE_MAP[normalized];
    if (role) return role;
  }
  return FALLBACK_ROLE;
}
