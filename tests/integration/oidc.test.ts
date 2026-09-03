/* eslint-disable @typescript-eslint/no-explicit-any -- reaching into db/schema internals for test-only cleanup */
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "@/env";
import { provisionUserFromClaims } from "@/lib/auth/provision";
import { db, schema } from "@/lib/db/client";
import * as repo from "@/lib/db/repository";
import { getOidcConfig } from "@/lib/auth/oidc";
import * as client from "openid-client";

const hasOidcConfig = Boolean(env.OIDC_ISSUER_URL && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET);

/**
 * Full authorization-code + PKCE flow requires a real browser to drive
 * Keycloak's login form and follow redirects — that path was verified
 * manually end-to-end (login as a fresh user, login as a group-mapped
 * user, dashboard renders, sign-out clears the session). What's
 * automated here is the resource-owner-password-credentials grant (the
 * `arr-hub` test client has directAccessGrantsEnabled) against the same
 * real Keycloak, to get real signed claims and drive the exact
 * provisioning logic the callback route calls.
 */
async function fetchRealClaims(username: string, password: string) {
  const config = await getOidcConfig();
  const tokens = await client.genericGrantRequest(config, "password", {
    username,
    password,
    scope: "openid profile email",
  });
  const claims = tokens.claims();
  if (!claims) throw new Error(`No id_token claims returned for ${username}`);
  return claims;
}

async function deleteLocalUser(oidcSubject: string) {
  const anyDb = db as never as { select: any; delete: any };
  const rows = await (anyDb as any)
    .select()
    .from((schema as any).users)
    .where(eq((schema as any).users.oidcSubject, oidcSubject));
  for (const row of rows) {
    // requests.userId / requests.decidedBy both FK to users.id with no cascade —
    // must clear these first or the user delete below hits a FK constraint.
    await (anyDb as any).delete((schema as any).requests).where(eq((schema as any).requests.userId, row.id));
    await (anyDb as any)
      .delete((schema as any).requests)
      .where(eq((schema as any).requests.decidedBy, row.id));
    await (anyDb as any).delete((schema as any).userRoles).where(eq((schema as any).userRoles.userId, row.id));
    await (anyDb as any).delete((schema as any).sessions).where(eq((schema as any).sessions.userId, row.id));
    await (anyDb as any).delete((schema as any).users).where(eq((schema as any).users.id, row.id));
  }
}

describe.skipIf(!hasOidcConfig)("OIDC login provisioning (real Keycloak)", () => {
  let testUserSubject: string;
  let adminUserSubject: string;

  beforeEach(async () => {
    const [testClaims, adminClaims] = await Promise.all([
      fetchRealClaims("testuser", "testpass123"),
      fetchRealClaims("adminuser", "adminpass123"),
    ]);
    testUserSubject = testClaims.sub;
    adminUserSubject = adminClaims.sub;
    await deleteLocalUser(testUserSubject);
    await deleteLocalUser(adminUserSubject);
  });

  afterAll(async () => {
    if (testUserSubject) await deleteLocalUser(testUserSubject);
    if (adminUserSubject) await deleteLocalUser(adminUserSubject);
  });

  it("provisions a brand-new user with no matching group as viewer (default-role path)", async () => {
    const claims = await fetchRealClaims("testuser", "testpass123");
    const user = await provisionUserFromClaims({
      sub: claims.sub,
      email: claims.email as string | undefined,
      name: claims.name as string | undefined,
      groups: claims.groups as string[] | undefined,
    });

    expect(user.oidcSubject).toBe(testUserSubject);
    expect(user.email).toBe("testuser@example.com");
    const roles = await repo.getUserRoles(user.id);
    expect(roles).toEqual(["viewer"]);
  });

  it("provisions a user in the Keycloak 'admins' group as admin (existing role mapping path)", async () => {
    const claims = await fetchRealClaims("adminuser", "adminpass123");
    expect(claims.groups).toContain("admins");

    const user = await provisionUserFromClaims({
      sub: claims.sub,
      email: claims.email as string | undefined,
      name: claims.name as string | undefined,
      groups: claims.groups as string[] | undefined,
    });

    const roles = await repo.getUserRoles(user.id);
    expect(roles).toEqual(["admin"]);
  });

  it("does not re-derive role from groups on a second login (role changes are managed via /admin/users afterward)", async () => {
    const claims = await fetchRealClaims("adminuser", "adminpass123");
    const first = await provisionUserFromClaims({ sub: claims.sub, email: claims.email as string, groups: ["admins"] });
    await repo.setUserRole(first.id, "viewer"); // simulate an admin having demoted this user

    const second = await provisionUserFromClaims({ sub: claims.sub, email: claims.email as string, groups: ["admins"] });
    expect(second.id).toBe(first.id);
    const roles = await repo.getUserRoles(second.id);
    expect(roles).toEqual(["viewer"]);
  });
});
