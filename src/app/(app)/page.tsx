import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { serviceRegistry } from "@/lib/services/registry";
import type { QueueItem, ServiceHealth } from "@/lib/services/types";

export const dynamic = "force-dynamic";

interface ServiceStatusRow {
  id: string;
  label: string;
  health: ServiceHealth;
}

async function loadServiceStatuses(): Promise<ServiceStatusRow[]> {
  const clients = [...serviceRegistry.values()];
  const healths = await Promise.all(clients.map((c) => c.healthCheck()));
  return clients.map((c, i) => ({ id: c.id, label: c.label, health: healths[i] }));
}

async function loadQueue(): Promise<(QueueItem & { service: string })[]> {
  const entries = await Promise.all(
    [...serviceRegistry.values()]
      .filter((c) => c.getQueue)
      .map(async (c) => {
        try {
          const items = await c.getQueue!();
          return items.map((item) => ({ ...item, service: c.label }));
        } catch {
          return [];
        }
      }),
  );
  return entries.flat();
}

async function loadCalendar() {
  const start = new Date();
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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

export default async function DashboardPage() {
  const [statuses, queue, calendar] = await Promise.all([
    loadServiceStatuses(),
    loadQueue(),
    loadCalendar(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Live status across every connected service.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statuses.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <Badge variant={s.health.status === "up" ? "default" : "destructive"}>
                {s.health.status === "up" ? "Up" : "Down"}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {s.health.status === "up" ? (s.health.version ?? "—") : (s.health.message ?? "Unreachable")}
              </p>
            </CardContent>
          </Card>
        ))}
        {statuses.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No services configured — set at least one service&apos;s URL/API key to see status here.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing downloading right now.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((item) => (
                    <TableRow key={`${item.service}-${item.id}`}>
                      <TableCell className="max-w-48 truncate">{item.title}</TableCell>
                      <TableCell>{item.service}</TableCell>
                      <TableCell className="capitalize">{item.status.toLowerCase()}</TableCell>
                      <TableCell className="text-right">
                        {item.progress !== null ? `${item.progress}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming up (next 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {calendar.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing scheduled in the next 7 days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calendar.map((item) => (
                    <TableRow key={`${item.service}-${item.id}`}>
                      <TableCell className="max-w-48 truncate">{item.title}</TableCell>
                      <TableCell>{item.service}</TableCell>
                      <TableCell className="text-right">
                        {new Date(item.date).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
