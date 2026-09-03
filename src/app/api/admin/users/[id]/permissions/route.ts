import { NextResponse } from "next/server";
import { z } from "zod";
import { SERVICE_IDS } from "@/env";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { PERMISSION_ACTIONS } from "@/lib/db/models";
import * as repo from "@/lib/db/repository";

const bodySchema = z.object({
  service: z.enum(SERVICE_IDS),
  action: z.enum(PERMISSION_ACTIONS),
  granted: z.boolean(),
});

const deleteSchema = z.object({
  service: z.enum(SERVICE_IDS),
  action: z.enum(PERMISSION_ACTIONS),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const overrides = await repo.listServicePermissionOverrides(id);
  return NextResponse.json(overrides);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await repo.getUserById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const { service, action, granted } = parsed.data;
  await repo.setServicePermissionOverride(id, service, action, granted);
  return NextResponse.json({ ok: true });
}

/** Removes an override, reverting that service/action back to the user's role default. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await repo.getUserById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  await repo.deleteServicePermissionOverride(id, parsed.data.service, parsed.data.action);
  return NextResponse.json({ ok: true });
}
