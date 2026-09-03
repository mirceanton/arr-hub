"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSION_ACTIONS, ROLES, type PermissionAction, type Role } from "@/lib/db/models";
import type { UserWithRoles } from "@/lib/db/models";

interface ServiceOption {
  id: string;
  label: string;
}

type OverrideState = "inherit" | "granted" | "denied";

export function AdminUsersClient({
  services,
  initialUsers,
}: {
  services: ServiceOption[];
  initialUsers: UserWithRoles[];
}) {
  const [users, setUsers] = useState<UserWithRoles[]>(initialUsers);
  const [permUser, setPermUser] = useState<UserWithRoles | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean> | null>(null);

  async function changeRole(userId: string, role: Role) {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      toast.error("Failed to update role");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, roles: [role] } : u)));
    toast.success("Role updated");
  }

  async function openPermissions(user: UserWithRoles) {
    setPermUser(user);
    setOverrides(null);
    const res = await fetch(`/api/admin/users/${user.id}/permissions`);
    const list: { service: string; action: PermissionAction; granted: boolean }[] = res.ok
      ? await res.json()
      : [];
    const map: Record<string, boolean> = {};
    for (const o of list) map[`${o.service}:${o.action}`] = o.granted;
    setOverrides(map);
  }

  async function setOverride(service: string, action: PermissionAction, state: OverrideState) {
    if (!permUser) return;
    const key = `${service}:${action}`;
    try {
      if (state === "inherit") {
        const res = await fetch(`/api/admin/users/${permUser.id}/permissions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service, action }),
        });
        if (!res.ok) throw new Error();
        setOverrides((prev) => {
          const next = { ...(prev ?? {}) };
          delete next[key];
          return next;
        });
      } else {
        const granted = state === "granted";
        const res = await fetch(`/api/admin/users/${permUser.id}/permissions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service, action, granted }),
        });
        if (!res.ok) throw new Error();
        setOverrides((prev) => ({ ...(prev ?? {}), [key]: granted }));
      }
    } catch {
      toast.error("Failed to update permission");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">Manage roles and per-service permission overrides.</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Permissions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{u.displayName}</span>
                  <span className="text-muted-foreground text-xs">{u.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={u.roles[0] ?? "viewer"}
                  onValueChange={(role) => role && changeRole(u.id, role as Role)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => openPermissions(u)}>
                  Permissions
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={permUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPermUser(null);
            setOverrides(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Permission overrides — {permUser?.displayName}</DialogTitle>
            <DialogDescription>
              An override wins over the role default for that service and action. Set back to
              &quot;Inherit&quot; to fall back to the role default.
            </DialogDescription>
          </DialogHeader>
          {overrides === null ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="flex flex-col gap-4">
              {services.map((s) => (
                <div key={s.id} className="flex flex-col gap-2">
                  <p className="text-sm font-medium">{s.label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PERMISSION_ACTIONS.map((action) => {
                      const key = `${s.id}:${action}`;
                      const current: OverrideState =
                        key in overrides ? (overrides[key] ? "granted" : "denied") : "inherit";
                      return (
                        <div key={action} className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs capitalize">{action}</span>
                          <Select
                            value={current}
                            onValueChange={(value) => value && setOverride(s.id, action, value as OverrideState)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Inherit</SelectItem>
                              <SelectItem value="granted">Granted</SelectItem>
                              <SelectItem value="denied">Denied</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
