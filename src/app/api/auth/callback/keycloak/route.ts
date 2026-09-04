import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { createSessionCookie } from "@/lib/auth/session";
import { appOrigin, getOidcConfig } from "@/lib/auth/oidc";
import { provisionUserFromClaims } from "@/lib/auth/provision";
import { logger } from "@/lib/logger";

function loginError(code: string) {
  const url = new URL("/login", appOrigin);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const store = await cookies();
  const codeVerifier = store.get("oidc_verifier")?.value;
  const expectedState = store.get("oidc_state")?.value;
  store.delete("oidc_verifier");
  store.delete("oidc_state");

  if (!codeVerifier || !expectedState) {
    return loginError("missing_state");
  }

  const config = await getOidcConfig();

  let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
  try {
    tokens = await client.authorizationCodeGrant(config, new URL(request.url), {
      pkceCodeVerifier: codeVerifier,
      expectedState,
    });
  } catch (err) {
    logger.warn({ err }, "OIDC authorization code grant failed");
    return loginError("oidc_failed");
  }

  const claims = tokens.claims();
  if (!claims) return loginError("no_id_token");

  const user = await provisionUserFromClaims({
    sub: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    groups: Array.isArray(claims.groups)
      ? claims.groups.filter((g): g is string => typeof g === "string")
      : undefined,
  });
  logger.info({ userId: user.id, subject: claims.sub }, "OIDC login");

  await createSessionCookie(user.id);
  return NextResponse.redirect(new URL("/", appOrigin));
}
