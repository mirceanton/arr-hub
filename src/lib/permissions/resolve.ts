import type { PermissionAction, Role, ServicePermissionOverride } from "@/lib/db/models";

const ROLE_RANK: Record<Role, number> = { viewer: 0, requester: 1, admin: 2 };

/** When a user somehow has more than one role assignment, the most privileged one wins. */
export function pickHighestRole(roles: Role[]): Role {
  if (roles.length === 0) return "viewer";
  return roles.reduce((best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best));
}

function defaultForRole(role: Role, action: PermissionAction): boolean {
  switch (role) {
    case "admin":
      return true;
    case "requester":
      return action === "view" || action === "request";
    case "viewer":
      return action === "view";
  }
}

/**
 * Effective permission resolution (spec §6): an explicit per-service
 * override always wins; otherwise fall back to the role's default for that
 * action. Pure function — no I/O — so it's unit-testable without a database.
 */
export function resolvePermission(input: {
  role: Role;
  overrides: Pick<ServicePermissionOverride, "service" | "action" | "granted">[];
  service: string;
  action: PermissionAction;
}): boolean {
  const override = input.overrides.find(
    (o) => o.service === input.service && o.action === input.action,
  );
  if (override) return override.granted;
  return defaultForRole(input.role, input.action);
}
