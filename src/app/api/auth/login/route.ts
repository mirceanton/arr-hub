import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as client from "openid-client";
import { env } from "@/env";
import { getOidcConfig, OIDC_SCOPE } from "@/lib/auth/oidc";

const STATE_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600, // 10 minutes — just long enough to complete the redirect round trip
};

export async function GET() {
  const config = await getOidcConfig();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: env.OIDC_REDIRECT_URI,
    scope: OIDC_SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  const store = await cookies();
  store.set("oidc_verifier", codeVerifier, STATE_COOKIE_OPTS);
  store.set("oidc_state", state, STATE_COOKIE_OPTS);

  return NextResponse.redirect(authorizationUrl);
}
