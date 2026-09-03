import { type NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { destroySessionCookie } from "@/lib/auth/session";
import { getOidcConfig } from "@/lib/auth/oidc";

export async function POST(request: NextRequest) {
  await destroySessionCookie();

  try {
    const config = await getOidcConfig();
    const endSessionUrl = client.buildEndSessionUrl(config, {
      post_logout_redirect_uri: new URL("/login", request.url).toString(),
    });
    return NextResponse.redirect(endSessionUrl);
  } catch {
    // Issuer doesn't advertise an end_session_endpoint (or discovery failed) — a local logout is still valid.
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
