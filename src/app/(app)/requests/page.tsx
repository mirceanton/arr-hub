import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import * as repo from "@/lib/db/repository";
import { serviceAccent } from "@/lib/service-style";
import type { RequestStatus } from "@/lib/db/models";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<RequestStatus, { color: string; bg: string }> = {
  pending: { color: "#eab308", bg: "rgba(234,179,8,.12)" },
  approved: { color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  fulfilled: { color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
  rejected: { color: "#ef4444", bg: "rgba(239,68,68,.12)" },
};

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

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t requested anything yet — try the Search page.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const status = STATUS_STYLE[r.status];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-64 truncate font-medium">{r.title}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 capitalize">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: serviceAccent(r.service) }}
                        />
                        {r.service}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.requestedAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className="inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                        style={{ color: status.color, background: status.bg }}
                      >
                        {r.status}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
