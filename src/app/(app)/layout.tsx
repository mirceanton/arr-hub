import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
