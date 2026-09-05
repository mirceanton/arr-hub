"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { serviceAccent } from "@/lib/service-style";
import type { RequestRecord, RequestStatus } from "@/lib/db/models";

const STATUS_STYLE: Record<RequestStatus, { color: string; bg: string }> = {
  pending: { color: "#eab308", bg: "rgba(234,179,8,.12)" },
  approved: { color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  fulfilled: { color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
  rejected: { color: "#ef4444", bg: "rgba(239,68,68,.12)" },
};

export type RequestRow = RequestRecord & { requesterName?: string };

export function RequestsClient({
  initialRequests,
  showRequester = false,
  emptyMessage = "You haven't requested anything yet — try the Search page.",
}: {
  initialRequests: RequestRow[];
  showRequester?: boolean;
  emptyMessage?: string;
}) {
  const [requests, setRequests] = useState<RequestRow[]>(initialRequests);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteRequest(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to delete request");
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Request deleted");
    } catch {
      toast.error("Failed to delete request");
    } finally {
      setDeletingId(null);
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Title</TableHead>
            <TableHead>Service</TableHead>
            {showRequester && <TableHead>Requested by</TableHead>}
            <TableHead>Requested</TableHead>
            <TableHead className="text-right">Status</TableHead>
            <TableHead className="w-10" />
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
                {showRequester && <TableCell>{r.requesterName ?? "—"}</TableCell>}
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
                <TableCell>
                  <button
                    onClick={() => deleteRequest(r.id)}
                    disabled={deletingId === r.id}
                    aria-label={`Delete request for ${r.title}`}
                    className="text-muted-foreground transition-colors hover:text-red-500 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
