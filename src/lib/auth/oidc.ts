import * as client from "openid-client";
import { env } from "@/env";

export const OIDC_SCOPE = "openid profile email";

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
