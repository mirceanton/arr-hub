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

export interface QueueProgress {
  /** 0-100, or null when the underlying service didn't report a size. */
  progress: number | null;
  status: string;
  timeLeft: string | null;
}

export function RequestsClient({
  initialRequests,
  showRequester = false,
  emptyMessage = "You haven't requested anything yet — try the Search page.",
  queueByTitle,
}: {
  initialRequests: RequestRow[];
  showRequester?: boolean;
  emptyMessage?: string;
  /** Keyed by request title, matched against the download queue — only meaningful for "approved" requests. */
  queueByTitle?: Record<string, QueueProgress>;
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
            const progress = r.status === "approved" ? queueByTitle?.[r.title] : undefined;
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
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                      style={{ color: status.color, background: status.bg }}
                    >
                      {r.status}
                    </span>
                    {progress && (
                      <div className="flex w-32 items-center gap-1.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[.08]">
                          <div
                            className="h-full rounded-full bg-[#3b82f6]"
                            style={{ width: progress.progress !== null ? `${progress.progress}%` : "100%" }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {progress.progress !== null ? `${progress.progress}%` : progress.status.toLowerCase()}
                        </span>
                      </div>
                    )}
                  </div>
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
