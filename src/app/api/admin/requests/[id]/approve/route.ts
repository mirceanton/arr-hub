import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { getServiceClient } from "@/lib/services/registry";
import { logger } from "@/lib/logger";
import type { ServiceId } from "@/env";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const target = await repo.getRequestById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.status !== "pending") {
    return NextResponse.json({ error: "Request has already been decided" }, { status: 409 });
  }

  const allowed = await can(user.id, target.service, "manage");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = getServiceClient(target.service as ServiceId);
  if (!client?.addItem) {
    return NextResponse.json({ error: "Service cannot add items" }, { status: 400 });
  }

  try {
    await client.addItem(target.externalId);
  } catch (err) {
    logger.error({ err, requestId: id, service: target.service }, "failed to add item on approval");
    return NextResponse.json({ error: "The service rejected the add — request left pending" }, { status: 502 });
  }

  const updated = await repo.decideRequest(id, { status: "approved", decidedBy: user.id });
  return NextResponse.json(updated);
}
