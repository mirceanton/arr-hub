import { requireUser } from "@/lib/auth/session";
import * as repo from "@/lib/db/repository";
import { RequestsClient } from "./requests-client";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const user = await requireUser();
  const requests = await repo.listRequestsByUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Requests</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Everything you&apos;ve requested and its current status.
        </p>
      </div>

      <RequestsClient initialRequests={requests} />
    </div>
  );
}
