"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, ListChecks, Radar, Search, ShieldCheck, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { serviceAccent } from "@/lib/service-style";
import type { ServiceStatus } from "@/lib/services/registry";
import type { UserRecord } from "@/lib/db/models";

export function AppSidebar({
  user,
  isAdmin,
  canManageAny,
  canViewIndexers,
  services,
}: {
  user: UserRecord;
  isAdmin: boolean;
  canManageAny: boolean;
  canViewIndexers: boolean;
  services: ServiceStatus[];
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const initials = user.displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ background: "linear-gradient(155deg,#8b5cf6,#6d28d9)" }}
            >
              A
            </div>
            <span className="font-semibold tracking-tight">Arr Hub</span>
          </div>
          <SidebarTrigger className="hidden md:flex" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Media</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/" />} isActive={isActive("/")}>
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/search" />} isActive={isActive("/search")}>
                  <Search />
                  <span>Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/requests" />} isActive={isActive("/requests")}>
                  <ListChecks />
                  <span>My Requests</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/activity" />} isActive={isActive("/activity")}>
                  <Activity />
                  <span>Activity</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {canViewIndexers && (
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/indexers" />} isActive={isActive("/indexers")}>
                    <Radar />
                    <span>Indexers</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isAdmin || canManageAny) && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {canManageAny && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/admin/requests" />}
                      isActive={isActive("/admin/requests")}
                    >
                      <ShieldCheck />
                      <span>Pending Requests</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/admin/users" />}
                      isActive={isActive("/admin/users")}
                    >
                      <Users />
                      <span>Users & Permissions</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {services.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Services</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-col gap-0.5 px-1">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: serviceAccent(s.id) }}
                    />
                    <span className="flex-1 truncate">{s.label}</span>
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        background: s.health.status === "up" ? "#22c55e" : "#ef4444",
                        boxShadow: `0 0 0 3px ${s.health.status === "up" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)"}`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="bg-primary/15 text-xs text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="POST" className="group-data-[collapsible=icon]:hidden">
            <button
              type="submit"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
