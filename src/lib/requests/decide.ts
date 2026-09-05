import type { ServiceId } from "@/env";
import type { RequestRecord } from "@/lib/db/models";
import * as repo from "@/lib/db/repository";
import { logger } from "@/lib/logger";
import { getServiceClient } from "@/lib/services/registry";

export type ApproveResult =
  | { ok: true; request: RequestRecord }
  | { ok: false; error: string; status: number };

/**
 * Adds the item to its target service and marks the request approved.
 * Shared by admin/manager approval and auto-approval, so both paths add to
 * the service — and fail the same way — identically.
 */
export async function approveRequest(request: RequestRecord, decidedBy: string): Promise<ApproveResult> {
  const client = getServiceClient(request.service as ServiceId);
  if (!client?.addItem) {
    return { ok: false, error: "Service cannot add items", status: 400 };
  }

  try {
    await client.addItem(request.externalId);
  } catch (err) {
    logger.error({ err, requestId: request.id, service: request.service }, "failed to add item on approval");
    return { ok: false, error: "The service rejected the add — request left pending", status: 502 };
  }

  const updated = await repo.decideRequest(request.id, { status: "approved", decidedBy });
  if (!updated) return { ok: false, error: "Request no longer exists", status: 404 };
  return { ok: true, request: updated };
}
