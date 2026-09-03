import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/services/registry";
import { serviceAccent } from "@/lib/service-style";

export const dynamic = "force-dynamic";

export default async function IndexersPage() {
  const user = await requireUser();
  const client = getServiceClient("prowlarr");

  if (!client) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Indexers</h1>
        <p className="text-sm text-muted-foreground">Prowlarr isn&apos;t configured for this deployment.</p>
      </div>
    );
  }

  const canView = await can(user.id, "prowlarr", "view");
  if (!canView) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Indexers</h1>
        <p className="text-sm text-muted-foreground">You don&apos;t have view access to Prowlarr.</p>
      </div>
    );
  }

  const [indexers, history] = await Promise.all([
    client.getIndexers?.() ?? Promise.resolve([]),
    client.getHistory?.(30) ?? Promise.resolve([]),
  ]);

  const accent = serviceAccent("prowlarr");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Indexers</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Torrent &amp; Usenet indexer health and recent grabs, via Prowlarr.
        </p>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <span className="text-[13px] font-semibold">Indexers</span>
          <span className="font-mono text-[11px] text-muted-foreground">{indexers.length} configured</span>
        </div>
        {indexers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No indexers configured in Prowlarr yet.</p>
        ) : (
          <div>
            {indexers.map((ix) => {
              const dotColor = ix.healthy ? "#22c55e" : ix.enabled ? "#eab308" : "#71717a";
              const statusLabel = !ix.enabled
                ? "Disabled"
                : ix.healthy
                  ? "Healthy"
                  : ix.disabledTill
                    ? `Backed off until ${new Date(ix.disabledTill).toLocaleString()}`
                    : "Unhealthy";
              return (
                <div
                  key={ix.id}
                  className="flex items-center gap-3.5 border-b border-border/40 px-4 py-3 last:border-b-0"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: dotColor }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{ix.name}</div>
                    <div className="text-[11px] text-muted-foreground">{statusLabel}</div>
                  </div>
                  <span
                    className="shrink-0 rounded-[5px] px-2 py-0.5 text-[10.5px] font-semibold capitalize"
                    style={{ color: accent, background: `${accent}1f` }}
                  >
                    {ix.protocol}
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                    P{ix.priority}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <span className="text-[13px] font-semibold">Grab history</span>
          <span className="font-mono text-[11px] text-muted-foreground">{history.length} recent</span>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nothing grabbed yet.</p>
        ) : (
          <div>
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-b-0"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: h.successful ? "#22c55e" : "#ef4444" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">{h.title}</div>
                  <div className="text-[11px] text-muted-foreground">{h.indexerName}</div>
                </div>
                <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                  {new Date(h.date).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
