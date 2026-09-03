import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";

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

  const updated = await repo.decideRequest(id, { status: "rejected", decidedBy: user.id });
  return NextResponse.json(updated);
}
