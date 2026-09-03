import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { serviceRegistry } from "@/lib/services/registry";
import { AdminUsersClient } from "./admin-users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) redirect("/");

  const services = [...serviceRegistry.values()].map((c) => ({ id: c.id, label: c.label }));
  const initialUsers = await repo.listUsersWithRoles();

  return <AdminUsersClient services={services} initialUsers={initialUsers} />;
}
