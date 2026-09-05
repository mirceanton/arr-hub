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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSION_ACTIONS, ROLES, type PermissionAction, type Role } from "@/lib/db/models";
import type { UserWithRoles } from "@/lib/db/models";

type AutoApproveState = "inherit" | "on" | "off";

function autoApproveState(value: boolean | null): AutoApproveState {
  if (value === null) return "inherit";
  return value ? "on" : "off";
}

interface ServiceOption {
  id: string;
  label: string;
}

type OverrideState = "inherit" | "granted" | "denied";

const AVATAR_COLORS = ["#8b5cf6", "#3b82f6", "#14b8a6", "#f97316", "#ec4899"];

const ROLE_STYLE: Record<Role, { color: string; bg: string }> = {
  admin: { color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
  requester: { color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  viewer: { color: "#a1a1aa", bg: "rgba(255,255,255,.08)" },
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AdminUsersClient({
  services,
  initialUsers,
  initialAutoApproveAll,
}: {
  services: ServiceOption[];
  initialUsers: UserWithRoles[];
  initialAutoApproveAll: boolean;
}) {
  const [users, setUsers] = useState<UserWithRoles[]>(initialUsers);
  const [permUser, setPermUser] = useState<UserWithRoles | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean> | null>(null);
  const [autoApproveAll, setAutoApproveAll] = useState(initialAutoApproveAll);
  const [savingAutoApproveAll, setSavingAutoApproveAll] = useState(false);

  async function toggleAutoApproveAll(checked: boolean) {
    setSavingAutoApproveAll(true);
    const previous = autoApproveAll;
    setAutoApproveAll(checked);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApproveAll: checked }),
      });
      if (!res.ok) throw new Error();
      toast.success(checked ? "Auto-approval enabled for everyone" : "Auto-approval disabled");
    } catch {
      setAutoApproveAll(previous);
      toast.error("Failed to update auto-approval default");
    } finally {
      setSavingAutoApproveAll(false);
    }
  }

  async function changeAutoApprove(userId: string, state: AutoApproveState) {
    const autoApprove = state === "inherit" ? null : state === "on";
    const res = await fetch(`/api/admin/users/${userId}/auto-approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApprove }),
    });
    if (!res.ok) {
      toast.error("Failed to update auto-approval");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, autoApprove } : u)));
    toast.success("Auto-approval updated");
  }

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
        <h1 className="text-xl font-semibold tracking-tight">Users & Permissions</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Manage household access per service.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-[10px] border border-border bg-card px-4 py-3.5">
        <div>
          <p className="text-[13.5px] font-semibold">Auto-approve requests by default</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            New requests skip the pending queue and are added immediately. Per-user overrides below
            take priority over this default.
          </p>
        </div>
        <Switch
          checked={autoApproveAll}
          onCheckedChange={toggleAutoApproveAll}
          disabled={savingAutoApproveAll}
        />
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Auto-approve</TableHead>
              <TableHead className="text-right">Permissions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u, i) => {
              const role = u.roles[0] ?? "viewer";
              const style = ROLE_STYLE[role];
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      >
                        {initials(u.displayName)}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.displayName}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={role}
                      onValueChange={(value) => value && changeRole(u.id, value as Role)}
                    >
                      <SelectTrigger
                        className="w-36 border-transparent font-semibold capitalize"
                        style={{ color: style.color, background: style.bg }}
                      >
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
                  <TableCell>
                    <Select
                      value={autoApproveState(u.autoApprove)}
                      onValueChange={(value) => value && changeAutoApprove(u.id, value as AutoApproveState)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Inherit</SelectItem>
                        <SelectItem value="on">On</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openPermissions(u)}>
                      Permissions
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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
            <p className="text-sm text-muted-foreground">Loading…</p>
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
                          <span className="text-xs text-muted-foreground capitalize">{action}</span>
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
