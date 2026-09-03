import type { UserRecord } from "@/lib/db/models";
import * as repo from "@/lib/db/repository";
import { resolveDefaultRoleFromGroups } from "./role-mapping";

export interface OidcClaims {
  sub: string;
  email?: string;
  name?: string;
  groups?: string[];
}

/**
 * Finds or creates the local user for an OIDC identity, applying the
 * group -> default role mapping only on first login (an existing user's
 * role is managed afterward via /admin/users, not re-derived from groups
 * on every login).
 */
export async function provisionUserFromClaims(claims: OidcClaims): Promise<UserRecord> {
  const email = claims.email ?? "";
  const displayName = claims.name || email || claims.sub;

  let user = await repo.findUserByOidcSubject(claims.sub);
  if (!user) {
    user = await repo.createUser({ oidcSubject: claims.sub, email, displayName });
    await repo.setUserRole(user.id, resolveDefaultRoleFromGroups(claims.groups ?? []));
  } else {
    await repo.touchLastLogin(user.id);
  }
  return user;
}
