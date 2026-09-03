"use client";

import { useState } from "react";
import { toast } from "sonner";
import { serviceAccent } from "@/lib/service-style";
import type { PendingRequestWithRequester } from "@/lib/db/repository";

export function AdminRequestsClient({
  initialRequests,
}: {
  initialRequests: PendingRequestWithRequester[];
}) {
  const [requests, setRequests] = useState<PendingRequestWithRequester[]>(initialRequests);
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function decide(id: string, decision: "approve" | "reject") {
    setActingOn(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}/${decision}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? `Failed to ${decision}`);
        return;
      }
      toast.success(decision === "approve" ? "Request approved" : "Request rejected");
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error(`Failed to ${decision}`);
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pending Requests</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Approve or reject requests for services you manage.
          </p>
        </div>
        <span
          className="rounded-lg px-2.5 py-1 text-xs font-semibold"
          style={{ color: "#eab308", background: "rgba(234,179,8,.12)" }}
        >
          {requests.length} pending
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-[10px] border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          All caught up — no pending requests.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => {
            const accent = serviceAccent(r.service);
            const busy = actingOn === r.id;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3.5 rounded-[10px] border border-border bg-card px-4 py-3.5"
              >
                <span className="h-8 w-[3px] shrink-0 rounded-sm" style={{ background: accent }} />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 truncate text-[13.5px] font-semibold">{r.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Requested by{" "}
                    <span className="font-medium text-foreground/70">{r.requesterName}</span> &middot;{" "}
                    <span className="capitalize">{r.service}</span> &middot;{" "}
                    {r.requestedAt.toLocaleDateString()}
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => decide(r.id, "reject")}
                  className="shrink-0 rounded-lg border border-white/[.12] px-3.5 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500 disabled:pointer-events-none disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  disabled={busy}
                  onClick={() => decide(r.id, "approve")}
                  className="shrink-0 rounded-lg bg-[#22c55e] px-3.5 py-1.5 text-xs font-semibold text-[#052e12] transition-colors hover:bg-[#16a34a] disabled:pointer-events-none disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
