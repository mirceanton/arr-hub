import type { ServiceId } from "@/env";
import { fetchJson } from "../http";
import type { GrabHistoryItem, IndexerStatus, MediaServiceClient, ServiceHealth } from "../types";

export interface ProwlarrClientConfig {
  baseUrl: string;
  apiKey: string;
}

interface RawIndexer {
  id: number;
  name: string;
  protocol: string;
  privacy: string;
  enable: boolean;
  priority: number;
}

interface RawIndexerStatus {
  indexerId: number;
  disabledTill?: string;
}

interface RawHistoryRecord {
  id: number;
  indexer?: string;
  title?: string;
  date: string;
  eventType: string;
  successful: boolean;
}

interface RawHistoryResponse {
  records: RawHistoryRecord[];
}

/**
 * Prowlarr manages indexers, not library items — it has nothing to search
 * or add on its own (that's what Sonarr/Radarr/Lidarr do against the
 * indexers Prowlarr aggregates), so like Bazarr it only implements the
 * `healthCheck` half of MediaServiceClient plus its own capability
 * (indexer status + grab history) rather than extending ServarrClient,
 * which forces abstract search/addItem that don't apply here.
 *
 * Verified against a live `ghcr.io/home-operations/prowlarr` container:
 * `/api/v1`, `X-Api-Key` header (same convention as the rest of the
 * family), `/system/status` shape matches Sonarr/Radarr/Lidarr, `/indexer`
 * and `/indexerstatus` are plain arrays (confirmed empty on a fresh
 * instance; field names for `/indexer` confirmed via `/indexer/schema`),
 * and `/history` is a paginated envelope (`{page, pageSize, ..., records}`)
 * like Sonarr/Radarr's own history endpoint. The sandbox this was verified
 * in has no outbound internet, so a real indexer couldn't be saved
 * (Prowlarr's connectivity check on save fails even with `forceSave=true`)
 * — the populated-record shapes for `/indexerstatus` and `/history` below
 * are Prowlarr's stable documented shape, not independently confirmed
 * against live data. Re-verify field names against a real populated
 * instance before relying on anything beyond what's used here.
 */
export class ProwlarrClient implements MediaServiceClient {
  readonly id: ServiceId = "prowlarr";
  readonly label = "Prowlarr";
  readonly mediaType = "indexers";

  constructor(private readonly config: ProwlarrClientConfig) {}

  private request<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/api/v1${path}`;
    return fetchJson<T>(url, { headers: { "X-Api-Key": this.config.apiKey } });
  }

  async healthCheck(): Promise<ServiceHealth> {
    try {
      const status = await this.request<{ version: string }>("/system/status");
      return { status: "up", version: status.version };
    } catch (err) {
      return { status: "down", message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getIndexers(): Promise<IndexerStatus[]> {
    const [indexers, statuses] = await Promise.all([
      this.request<RawIndexer[]>("/indexer"),
      this.request<RawIndexerStatus[]>("/indexerstatus"),
    ]);
    const disabledTillByIndexerId = new Map(statuses.map((s) => [s.indexerId, s.disabledTill ?? null]));

    return indexers.map((ix) => {
      const disabledTill = disabledTillByIndexerId.get(ix.id) ?? null;
      const backedOff = disabledTill !== null && new Date(disabledTill) > new Date();
      return {
        id: String(ix.id),
        name: ix.name,
        protocol: ix.protocol === "usenet" ? "usenet" : "torrent",
        privacy: ix.privacy,
        enabled: ix.enable,
        priority: ix.priority,
        healthy: ix.enable && !backedOff,
        disabledTill: backedOff ? disabledTill : null,
      };
    });
  }

  async getHistory(limit = 25): Promise<GrabHistoryItem[]> {
    const qs = new URLSearchParams({
      pageSize: String(limit),
      sortKey: "date",
      sortDirection: "descending",
    });
    const data = await this.request<RawHistoryResponse>(`/history?${qs}`);
    return data.records.map((r) => ({
      id: String(r.id),
      indexerName: r.indexer ?? "Unknown",
      title: r.title ?? "Unknown",
      date: r.date,
      eventType: r.eventType,
      successful: r.successful,
    }));
  }
}
