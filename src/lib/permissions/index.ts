import type { PermissionAction } from "@/lib/db/models";
import * as repo from "@/lib/db/repository";
import { pickHighestRole, resolvePermission } from "./resolve";

export { pickHighestRole, resolvePermission };

/** DB-backed effective-permission check for a signed-in user. */
export async function can(userId: string, service: string, action: PermissionAction): Promise<boolean> {
  const [roles, overrides] = await Promise.all([
    repo.getUserRoles(userId),
    repo.listServicePermissionOverrides(userId),
  ]);
  return resolvePermission({ role: pickHighestRole(roles), overrides, service, action });
}

export async function isAdmin(userId: string): Promise<boolean> {
  const roles = await repo.getUserRoles(userId);
  return pickHighestRole(roles) === "admin";
}
