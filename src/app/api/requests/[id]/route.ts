import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const target = await repo.getRequestById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = target.userId === user.id;
  const canManage = await can(user.id, target.service, "manage");
  if (!isOwner && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await repo.deleteRequest(id);
  return new NextResponse(null, { status: 204 });
}
