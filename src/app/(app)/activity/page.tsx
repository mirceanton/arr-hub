import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { serviceAccent } from "@/lib/service-style";
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
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Requests and service events across every service you can see, newest first.
        </p>
      </div>

      {feed.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
      ) : (
        <div className="relative pl-5">
          <div className="absolute top-1.5 bottom-1.5 left-[5px] w-px bg-border" />
          {feed.map((entry) => {
            const accent = serviceAccent(entry.data.service);
            const kind = entry.kind === "request" ? entry.data.status.toUpperCase() : entry.data.eventType.toUpperCase();
            const message =
              entry.kind === "request" ? describeRequest(entry.data) : `${entry.data.eventType} event received`;
            return (
              <div key={`${entry.kind}-${entry.data.id}`} className="relative pb-5">
                <span
                  className="absolute top-[3px] -left-5 size-2.5 rounded-full border-2 bg-[#0c0c0e]"
                  style={{ borderColor: accent }}
                />
                <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                  <span
                    className="rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold"
                    style={{ color: accent, background: `${accent}1f` }}
                  >
                    {kind}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {entry.at.toLocaleString()}
                  </span>
                </div>
                <div className="text-[13px] text-foreground/85">{message}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
