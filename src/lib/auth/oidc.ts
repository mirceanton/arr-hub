import * as client from "openid-client";
import { env } from "@/env";

export const OIDC_SCOPE = "openid profile email";

/**
 * request.url's host reflects whatever the reverse proxy sent as the Host
 * header, which isn't always the externally-visible one — deriving the app's
 * own origin from OIDC_REDIRECT_URI instead keeps post-login/post-logout
 * redirects pointed at the real hostname regardless of proxy behavior.
 */
export const appOrigin = new URL(env.OIDC_REDIRECT_URI).origin;

let configPromise: Promise<client.Configuration> | null = null;

/**
 * Discovery is memoized for the process lifetime — every login/callback
 * reuses the same Configuration rather than re-fetching the issuer's
 * well-known document on every request.
 */
export function getOidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    const server = new URL(env.OIDC_ISSUER_URL);
    const isLoopbackHttp = server.protocol === "http:";
    configPromise = client.discovery(
      server,
      env.OIDC_CLIENT_ID,
      { client_secret: env.OIDC_CLIENT_SECRET },
      client.ClientSecretPost(env.OIDC_CLIENT_SECRET),
      isLoopbackHttp ? { execute: [client.allowInsecureRequests] } : undefined,
    );
  }
  return configPromise;
}
