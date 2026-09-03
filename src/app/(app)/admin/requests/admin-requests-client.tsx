"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RequestRecord } from "@/lib/db/models";

export function AdminRequestsClient({ initialRequests }: { initialRequests: RequestRecord[] }) {
  const [requests, setRequests] = useState<RequestRecord[]>(initialRequests);
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pending Requests</h1>
        <p className="text-muted-foreground text-sm">Approve or reject requests for services you manage.</p>
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing pending.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-64 truncate">{r.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {r.service}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(r.requestedAt).toLocaleDateString()}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    disabled={actingOn === r.id}
                    onClick={() => decide(r.id, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingOn === r.id}
                    onClick={() => decide(r.id, "reject")}
                  >
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
