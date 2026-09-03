import { NextResponse } from "next/server";
import { SERVICE_IDS, type ServiceId } from "@/env";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/services/registry";

function isServiceId(value: string): value is ServiceId {
  return (SERVICE_IDS as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const service = url.searchParams.get("service") ?? "";
  const q = url.searchParams.get("q") ?? "";

  if (!isServiceId(service) || q.trim().length === 0) {
    return NextResponse.json({ error: "service and q query params are required" }, { status: 400 });
  }

  const client = getServiceClient(service);
  if (!client?.search) {
    return NextResponse.json({ error: "Service not configured or not searchable" }, { status: 400 });
  }

  const allowed = await can(user.id, service, "view");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const results = await client.search(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
