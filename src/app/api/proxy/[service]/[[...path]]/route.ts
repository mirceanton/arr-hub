import { NextResponse, type NextRequest } from "next/server";
import { SERVICE_IDS, getServiceEnvConfig, type ServiceId } from "@/env";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { isAdmin } from "@/lib/permissions";

function isServiceId(value: string): value is ServiceId {
  return (SERVICE_IDS as readonly string[]).includes(value);
}

/**
 * Headers that must not be copied verbatim from the upstream response:
 * content-encoding/length/transfer-encoding would mismatch the body we
 * actually send (fetch already decodes compressed bodies for us), and
 * frame/CSP headers would defeat the entire point of embedding this in an
 * iframe on arr-hub's own origin.
 */
const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
]);

/**
 * Break-glass admin proxy: lets an admin reach a configured service's own
 * web UI (Sonarr/Radarr/etc.) through arr-hub's origin, since those services
 * usually aren't exposed outside the cluster on their own. The target
 * service's "URL Base" setting needs to be set to `/api/proxy/<service>`
 * for its own root-relative asset/API links to resolve correctly through
 * this proxy — that's a one-time setting on the service itself, not
 * something this route can safely do on the user's behalf.
 */
async function proxy(request: NextRequest, { params }: { params: Promise<{ service: string; path?: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { service, path } = await params;
  if (!isServiceId(service)) return NextResponse.json({ error: "Unknown service" }, { status: 404 });

  const config = getServiceEnvConfig(service);
  if (!config) return NextResponse.json({ error: "Service not configured" }, { status: 400 });

  const suffix = (path ?? []).join("/");
  const search = new URL(request.url).search;
  const targetUrl = `${config.baseUrl.replace(/\/$/, "")}/${suffix}${search}`;

  const headers = new Headers({ "X-Api-Key": config.apiKey });
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");
  if (accept) headers.set("Accept", accept);
  if (contentType) headers.set("Content-Type", contentType);

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    });
  } catch (err) {
    logger.error({ err, service, targetUrl }, "proxy request to service failed");
    return NextResponse.json({ error: "Failed to reach service" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
