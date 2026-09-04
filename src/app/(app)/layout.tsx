import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileTopBar } from "@/components/mobile-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ViewerRoleBanner } from "@/components/viewer-role-banner";
import { env } from "@/env";
import { requireUser } from "@/lib/auth/session";
import { can, pickHighestRole } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { getConfiguredServiceIds, getServiceStatuses } from "@/lib/services/registry";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const roles = await repo.getUserRoles(user.id);
  const highestRole = pickHighestRole(roles);
  const isAdmin = highestRole === "admin";
  const isViewer = highestRole === "viewer";

  const configuredServices = getConfiguredServiceIds();
  const prowlarrConfigured = configuredServices.includes("prowlarr");
  const [manageChecks, services, canViewIndexersRaw] = await Promise.all([
    Promise.all(configuredServices.map((id) => can(user.id, id, "manage"))),
    getServiceStatuses(),
    prowlarrConfigured ? can(user.id, "prowlarr", "view") : Promise.resolve(false),
  ]);
  const canManageAny = manageChecks.some(Boolean);
  const canViewIndexers = prowlarrConfigured && canViewIndexersRaw;

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        isAdmin={isAdmin}
        canManageAny={canManageAny}
        canViewIndexers={canViewIndexers}
        services={services}
        appTitle={env.APP_TITLE}
      />
      <SidebarInset>
        <MobileTopBar
          user={user}
          isAdmin={isAdmin}
          canManageAny={canManageAny}
          canViewIndexers={canViewIndexers}
          appTitle={env.APP_TITLE}
        />
        <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-6">
          {isViewer && <ViewerRoleBanner />}
          {children}
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
