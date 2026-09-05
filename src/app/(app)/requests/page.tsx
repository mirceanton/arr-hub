import type { ServiceId } from "@/env";
import { requireUser } from "@/lib/auth/session";
import * as repo from "@/lib/db/repository";
import { getServiceClient } from "@/lib/services/registry";
import type { QueueProgress } from "./requests-client";
import { RequestsClient } from "./requests-client";

export const dynamic = "force-dynamic";

/** Download-queue progress for a user's approved-but-not-yet-fulfilled requests, matched by title. */
async function loadQueueProgress(services: ServiceId[]): Promise<Record<string, QueueProgress>> {
  const byTitle: Record<string, QueueProgress> = {};
  await Promise.all(
    services.map(async (id) => {
      const client = getServiceClient(id);
      if (!client?.getQueue) return;
      try {
        for (const item of await client.getQueue()) {
          byTitle[item.title] = { progress: item.progress, status: item.status, timeLeft: item.timeLeft };
        }
      } catch {
        // Queue unavailable for this service — those requests just show without a progress bar.
      }
    }),
  );
  return byTitle;
}

export default async function MyRequestsPage() {
  const user = await requireUser();
  const requests = await repo.listRequestsByUser(user.id);

  const approvedServices = [
    ...new Set(requests.filter((r) => r.status === "approved").map((r) => r.service as ServiceId)),
  ];
  const queueByTitle = await loadQueueProgress(approvedServices);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Requests</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Everything you&apos;ve requested and its current status.
        </p>
      </div>

      <RequestsClient initialRequests={requests} queueByTitle={queueByTitle} />
    </div>
  );
}
