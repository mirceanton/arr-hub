import type { UserRecord } from "@/lib/db/models";
import * as repo from "@/lib/db/repository";
import { matchRoleFromGroups, resolveDefaultRoleFromGroups } from "./role-mapping";

export interface OidcClaims {
  sub: string;
  email?: string;
  name?: string;
  groups?: string[];
}

/**
 * Finds or creates the local user for an OIDC identity. A returning user's
 * role is re-synced from their current Keycloak groups on every login *if*
 * those groups match GROUP_ROLE_MAP — so promoting/demoting someone in
 * Keycloak takes effect on their next login without needing /admin/users.
 * A user in none of the mapped groups keeps whatever role they already
 * have (manual /admin/users grants for people outside the mapping aren't
 * clobbered back to the viewer fallback on every login).
 */
export async function provisionUserFromClaims(claims: OidcClaims): Promise<UserRecord> {
  const email = claims.email ?? "";
  const displayName = claims.name || email || claims.sub;
  const groups = claims.groups ?? [];

  let user = await repo.findUserByOidcSubject(claims.sub);
  if (!user) {
    user = await repo.createUser({ oidcSubject: claims.sub, email, displayName });
    await repo.setUserRole(user.id, resolveDefaultRoleFromGroups(groups));
  } else {
    await repo.touchLastLogin(user.id);
    const matchedRole = matchRoleFromGroups(groups);
    if (matchedRole) await repo.setUserRole(user.id, matchedRole);
  }
  return user;
}
