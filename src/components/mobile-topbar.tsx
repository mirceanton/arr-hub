"use client";

import Link from "next/link";
import { LogOut, ShieldCheck, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UserRecord } from "@/lib/db/models";

export function MobileTopBar({
  user,
  isAdmin,
  canManageAny,
}: {
  user: UserRecord;
  isAdmin: boolean;
  canManageAny: boolean;
}) {
  const initials = user.displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hasAdminItems = isAdmin || canManageAny;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4 md:hidden">
      <div className="flex items-center gap-2">
        <div
          className="flex size-6 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ background: "linear-gradient(155deg,#8b5cf6,#6d28d9)" }}
        >
          A
        </div>
        <span className="text-sm font-semibold tracking-tight">Arr Hub</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full outline-none">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/15 text-xs text-primary">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-foreground">{user.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>

          {hasAdminItems && (
            <>
              <DropdownMenuSeparator />
              {canManageAny && (
                <DropdownMenuItem render={<Link href="/admin/requests" />}>
                  <ShieldCheck className="size-4" />
                  Pending Requests
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem render={<Link href="/admin/users" />}>
                  <Users className="size-4" />
                  Users & Permissions
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />
          <form action="/api/auth/logout" method="POST" className="contents">
            <DropdownMenuItem variant="destructive" nativeButton render={<button type="submit" />}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
