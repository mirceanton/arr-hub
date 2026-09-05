import { NextResponse } from "next/server";
import { z } from "zod";
import { SERVICE_IDS } from "@/env";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { approveRequest } from "@/lib/requests/decide";
import { getServiceClient } from "@/lib/services/registry";

const bodySchema = z.object({
  service: z.enum(SERVICE_IDS),
  externalId: z.string().min(1),
  title: z.string().min(1),
  mediaType: z.string().min(1),
  selection: z.object({ seasonNumbers: z.array(z.number()).optional() }).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requests = await repo.listRequestsByUser(user.id);
  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { service, externalId, title, mediaType, selection } = parsed.data;

  if (!getServiceClient(service)) {
    return NextResponse.json({ error: "Service not configured" }, { status: 400 });
  }
  const allowed = await can(user.id, service, "request");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const created = await repo.createRequest({
    userId: user.id,
    service,
    externalId,
    title,
    mediaType,
    selection: selection ? JSON.stringify(selection) : null,
  });

  if (await repo.getEffectiveAutoApprove(user.id)) {
    const result = await approveRequest(created, user.id);
    if (result.ok) return NextResponse.json(result.request, { status: 201 });
    // Auto-approval failing (e.g. the service rejected the add) isn't a request-creation failure —
    // the request itself was created fine and is left pending for manual approval instead.
  }

  return NextResponse.json(created, { status: 201 });
}
