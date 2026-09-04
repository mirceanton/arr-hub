import { NextResponse } from "next/server";
import * as client from "openid-client";
import { destroySessionCookie } from "@/lib/auth/session";
import { appOrigin, getOidcConfig } from "@/lib/auth/oidc";

export async function POST() {
  await destroySessionCookie();

  try {
    const config = await getOidcConfig();
    const endSessionUrl = client.buildEndSessionUrl(config, {
      post_logout_redirect_uri: new URL("/login", appOrigin).toString(),
    });
    return NextResponse.redirect(endSessionUrl);
  } catch {
    // Issuer doesn't advertise an end_session_endpoint (or discovery failed) — a local logout is still valid.
    return NextResponse.redirect(new URL("/login", appOrigin));
  }
}
