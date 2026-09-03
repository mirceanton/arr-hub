import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import * as repo from "@/lib/db/repository";
import type { RequestStatus } from "@/lib/db/models";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<RequestStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  fulfilled: "default",
  rejected: "destructive",
};

export default async function MyRequestsPage() {
  const user = await requireUser();
  const requests = await repo.listRequestsByUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Requests</h1>
        <p className="text-muted-foreground text-sm">Everything you&apos;ve requested and its current status.</p>
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          You haven&apos;t requested anything yet — try the Search page.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-64 truncate">{r.title}</TableCell>
                <TableCell className="capitalize">{r.service}</TableCell>
                <TableCell>{r.requestedAt.toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                    {r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
