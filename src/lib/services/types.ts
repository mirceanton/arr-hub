import type { ServiceId } from "@/env";

export interface ServiceHealth {
  status: "up" | "down";
  version?: string;
  message?: string;
}

export interface SearchResult {
  externalId: string;
  title: string;
  year?: number;
  overview?: string;
  posterUrl?: string;
  mediaType: string;
}

export interface QueueItem {
  id: string;
  title: string;
  status: string;
  /** 0-100, or null when the underlying service didn't report a size. */
  progress: number | null;
  timeLeft: string | null;
}

export interface CalendarItem {
  id: string;
  title: string;
  /** ISO 8601 date/time string. */
  date: string;
  mediaType: string;
}

export interface IndexerStatus {
  id: string;
  name: string;
  protocol: "torrent" | "usenet";
  privacy: string;
  enabled: boolean;
  priority: number;
  /** false when disabled, or currently in a Prowlarr-imposed backoff after repeated failures. */
  healthy: boolean;
  /** ISO 8601 string, or null when not currently backed off. */
  disabledTill: string | null;
}

export interface GrabHistoryItem {
  id: string;
  indexerName: string;
  title: string;
  /** ISO 8601 date/time string. */
  date: string;
  eventType: string;
  successful: boolean;
}

/**
 * The contract every media service client implements. Only `id`/`label`/
 * `mediaType`/`healthCheck` are required — the rest are optional because not
 * every service supports every capability (Bazarr manages subtitles for
 * items that already exist in Sonarr/Radarr; it has nothing to "search" or
 * "add". Prowlarr manages indexers, not library items; it has nothing to
 * queue or calendar, but does have indexer status + grab history). The
 * request/approve workflow and the unified search page only call the
 * optional methods on clients that declare them.
 *
 * To add a new service: implement this interface and register one entry in
 * `registry.ts`'s SERVICE_DEFINITIONS — nothing else in the app changes.
 */
export interface MediaServiceClient {
  readonly id: ServiceId;
  readonly label: string;
  readonly mediaType: string;
  healthCheck(): Promise<ServiceHealth>;
  search?(query: string): Promise<SearchResult[]>;
  addItem?(externalId: string): Promise<void>;
  getQueue?(): Promise<QueueItem[]>;
  getCalendar?(start: Date, end: Date): Promise<CalendarItem[]>;
  getIndexers?(): Promise<IndexerStatus[]>;
  getHistory?(limit?: number): Promise<GrabHistoryItem[]>;
}
