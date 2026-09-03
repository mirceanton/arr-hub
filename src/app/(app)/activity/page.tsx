import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import type { RequestRecord, ServiceEventRecord } from "@/lib/db/models";
import { getConfiguredServiceIds } from "@/lib/services/registry";

export const dynamic = "force-dynamic";

type FeedEntry =
  | { kind: "request"; at: Date; data: RequestRecord }
  | { kind: "event"; at: Date; data: ServiceEventRecord };

function describeRequest(r: RequestRecord): string {
  switch (r.status) {
    case "pending":
      return `requested "${r.title}"`;
    case "approved":
      return `approved "${r.title}"`;
    case "rejected":
      return `rejected "${r.title}"`;
    case "fulfilled":
      return `"${r.title}" was fulfilled`;
  }
}

export default async function ActivityPage() {
  const user = await requireUser();
  const configuredServices = getConfiguredServiceIds();
  const viewFlags = await Promise.all(configuredServices.map((id) => can(user.id, id, "view")));
  const visibleServices = configuredServices.filter((_, i) => viewFlags[i]);

  const [requests, events] = await Promise.all([
    repo.listRecentRequests(visibleServices, 50),
    repo.listRecentServiceEvents(visibleServices, 50),
  ]);

  const feed: FeedEntry[] = [
    ...requests.map((r): FeedEntry => ({ kind: "request", at: r.decidedAt ?? r.requestedAt, data: r })),
    ...events.map((e): FeedEntry => ({ kind: "event", at: e.receivedAt, data: e })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">
          Requests and service events across every service you can see, newest first.
        </p>
      </div>

      {feed.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing has happened yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {feed.map((entry) => (
            <li
              key={`${entry.kind}-${entry.data.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {entry.data.service}
                </Badge>
                <p className="text-sm">
                  {entry.kind === "request"
                    ? describeRequest(entry.data)
                    : `${entry.data.eventType} event received`}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">
                {entry.at.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
