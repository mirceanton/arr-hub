import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { getConfiguredServiceIds } from "@/lib/services/registry";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configuredServices = getConfiguredServiceIds();
  const manageFlags = await Promise.all(configuredServices.map((id) => can(user.id, id, "manage")));
  const manageableServices = configuredServices.filter((_, i) => manageFlags[i]);

  const requests = await repo.listPendingRequests(manageableServices);
  return NextResponse.json(requests);
}
