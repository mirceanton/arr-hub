import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { getConfiguredServiceIds } from "@/lib/services/registry";
import { AdminRequestsClient } from "./admin-requests-client";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  const user = await requireUser();
  const configuredServices = getConfiguredServiceIds();
  const manageFlags = await Promise.all(configuredServices.map((id) => can(user.id, id, "manage")));
  const manageableServices = configuredServices.filter((_, i) => manageFlags[i]);

  if (manageableServices.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pending Requests</h1>
        <p className="text-muted-foreground text-sm">
          You don&apos;t have manage access to any service.
        </p>
      </div>
    );
  }

  const initialRequests = await repo.listPendingRequestsWithRequester(manageableServices);
  return <AdminRequestsClient initialRequests={initialRequests} />;
}
