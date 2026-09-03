import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileTopBar } from "@/components/mobile-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/session";
import { can, pickHighestRole } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { getConfiguredServiceIds, getServiceStatuses } from "@/lib/services/registry";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const roles = await repo.getUserRoles(user.id);
  const isAdmin = pickHighestRole(roles) === "admin";

  const configuredServices = getConfiguredServiceIds();
  const [manageChecks, services] = await Promise.all([
    Promise.all(configuredServices.map((id) => can(user.id, id, "manage"))),
    getServiceStatuses(),
  ]);
  const canManageAny = manageChecks.some(Boolean);

  return (
    <SidebarProvider>
      <AppSidebar user={user} isAdmin={isAdmin} canManageAny={canManageAny} services={services} />
      <SidebarInset>
        <MobileTopBar user={user} isAdmin={isAdmin} canManageAny={canManageAny} />
        <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-6">{children}</div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
