import { serviceAccent } from "@/lib/service-style";
import { serviceRegistry, getServiceStatuses, type ServiceStatus } from "@/lib/services/registry";
import type { CalendarItem, QueueItem } from "@/lib/services/types";

export const dynamic = "force-dynamic";

type CalendarEntry = CalendarItem & { service: string };
type QueueEntry = QueueItem & { service: string; accent: string };

async function loadQueue(): Promise<QueueEntry[]> {
  const entries = await Promise.all(
    [...serviceRegistry.values()]
      .filter((c) => c.getQueue)
      .map(async (c) => {
        try {
          const items = await c.getQueue!();
          return items.map((item) => ({ ...item, service: c.label, accent: serviceAccent(c.id) }));
        } catch {
          return [];
        }
      }),
  );
  return entries.flat();
}

/** Full current-month range, so the calendar grid can mark every release day, not just the next 7. */
async function loadMonthCalendar(): Promise<CalendarEntry[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const entries = await Promise.all(
    [...serviceRegistry.values()]
      .filter((c) => c.getCalendar)
      .map(async (c) => {
        try {
          const items = await c.getCalendar!(start, end);
          return items.map((item) => ({ ...item, service: c.label }));
        } catch {
          return [];
        }
      }),
  );
  return entries.flat().sort((a, b) => a.date.localeCompare(b.date));
}

function dayGroupLabel(date: Date, today: Date): string {
  const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((d1.getTime() - d0.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusMeta(status: ServiceStatus["health"]["status"]) {
  return status === "up"
    ? { color: "#22c55e", label: "Online" }
    : { color: "#ef4444", label: "Offline" };
}

export default async function DashboardPage() {
  const [statuses, queue, calendar] = await Promise.all([
    getServiceStatuses(),
    loadQueue(),
    loadMonthCalendar(),
  ]);

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const releaseDays = new Set(calendar.map((c) => new Date(c.date).getDate()));
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayNum = now.getDate();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = calendar.filter((c) => new Date(c.date) >= todayStart);
  const upcomingGroups: { label: string; items: CalendarEntry[] }[] = [];
  for (const item of upcoming) {
    const label = dayGroupLabel(new Date(item.date), now);
    const group = upcomingGroups.find((g) => g.label === label);
    if (group) group.items.push(item);
    else upcomingGroups.push({ label, items: [item] });
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Household media stack overview</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {statuses.map((s) => {
          const meta = statusMeta(s.health.status);
          return (
            <div
              key={s.id}
              className="rounded-[10px] border border-border bg-card px-4 py-3.5"
              style={{ borderTop: `2px solid ${serviceAccent(s.id)}` }}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-foreground/85">{s.label}</span>
                <span
                  className="flex items-center gap-1.5 text-[10.5px] font-medium"
                  style={{ color: meta.color }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-lg font-semibold">
                  {s.health.status === "up" ? (s.health.version ?? "—") : "—"}
                </span>
              </div>
              {s.health.status === "down" && s.health.message && (
                <div className="mt-1.5 truncate text-[10.5px] text-muted-foreground">
                  {s.health.message}
                </div>
              )}
            </div>
          );
        })}
        {statuses.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            No services configured — set at least one service&apos;s URL/API key to see status here.
          </p>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <span className="text-[13px] font-semibold">Upcoming releases</span>
            <span className="font-mono text-[11px] text-muted-foreground">{monthLabel}</span>
          </div>

          <div className="border-b border-border/60 px-4 pt-3.5 pb-1.5">
            <div className="mb-1 grid grid-cols-7 gap-[3px]">
              {weekdays.map((wd, i) => (
                <div
                  key={i}
                  className="text-center font-mono text-[9.5px] text-muted-foreground/70"
                >
                  {wd}
                </div>
              ))}
            </div>
            <div className="mb-2 grid grid-cols-7 gap-[3px]">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const isToday = d === todayNum;
                const hasRelease = releaseDays.has(d);
                return (
                  <div
                    key={d}
                    className="flex aspect-square flex-col items-center justify-center rounded-md text-[10.5px]"
                    style={{
                      color: isToday ? "#fff" : hasRelease ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.4)",
                      background: isToday ? "#8b5cf6" : "transparent",
                    }}
                  >
                    <span>{d}</span>
                    <span
                      className="mt-0.5 size-[3px] rounded-full"
                      style={{ background: hasRelease && !isToday ? "#8b5cf6" : "transparent" }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {upcomingGroups.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Nothing scheduled this month.
              </p>
            )}
            {upcomingGroups.map((grp) => (
              <div key={grp.label}>
                <div className="sticky top-0 bg-card px-4 pt-2 pb-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
                  {grp.label}
                </div>
                {grp.items.map((ev) => (
                  <div key={`${ev.service}-${ev.id}`} className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[.03]">
                    <span
                      className="h-7 w-[3px] shrink-0 rounded-sm"
                      style={{ background: serviceAccent(ev.service.toLowerCase()) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{ev.title}</div>
                      <div className="text-[11px] text-muted-foreground">{ev.service}</div>
                    </div>
                    <span
                      className="shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        color: serviceAccent(ev.service.toLowerCase()),
                        background: `${serviceAccent(ev.service.toLowerCase())}1f`,
                      }}
                    >
                      {ev.mediaType}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <span className="text-[13px] font-semibold">Download queue</span>
            <span className="font-mono text-[11px] text-muted-foreground">{queue.length} active</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {queue.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nothing downloading right now.</p>
            )}
            {queue.map((item) => (
              <div key={`${item.service}-${item.id}`} className="border-b border-border/40 px-4 py-2.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: item.accent }} />
                  <span className="flex-1 truncate text-[12.5px] font-medium">{item.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[.08]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: item.accent,
                        width: item.progress !== null ? `${item.progress}%` : "100%",
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-[10.5px] text-muted-foreground capitalize">
                    {item.progress !== null ? `${item.progress}%` : item.status.toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
