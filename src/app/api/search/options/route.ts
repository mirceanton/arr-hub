import { NextResponse } from "next/server";
import { SERVICE_IDS, type ServiceId } from "@/env";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/services/registry";

function isServiceId(value: string): value is ServiceId {
  return (SERVICE_IDS as readonly string[]).includes(value);
}

/** Per-item monitoring options for the request-selection dialog — currently just Sonarr's seasons. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const service = url.searchParams.get("service") ?? "";
  const externalId = url.searchParams.get("externalId") ?? "";

  if (!isServiceId(service) || externalId.trim().length === 0) {
    return NextResponse.json({ error: "service and externalId query params are required" }, { status: 400 });
  }

  const client = getServiceClient(service);
  if (!client?.listSeasons) {
    return NextResponse.json({ seasons: null });
  }

  const allowed = await can(user.id, service, "view");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const seasons = await client.listSeasons(externalId);
    return NextResponse.json({ seasons });
  } catch {
    return NextResponse.json({ error: "Failed to load options" }, { status: 502 });
  }
}
