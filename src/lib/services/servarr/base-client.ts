import type { ServiceId } from "@/env";
import { fetchJson, ServiceRequestError } from "../http";
import type {
  CalendarItem,
  MediaServiceClient,
  QueueItem,
  RequestSelection,
  SearchResult,
  ServiceHealth,
} from "../types";

export interface ServarrClientConfig {
  baseUrl: string;
  apiKey: string;
}

interface RawQueueRecord {
  id: number;
  title?: string;
  status: string;
  size?: number;
  sizeleft?: number;
  timeleft?: string;
  series?: { title: string };
  movie?: { title: string };
  artist?: { artistName: string };
}

interface RawCalendarRecord {
  id: number;
  title?: string;
  airDateUtc?: string;
  inCinemas?: string;
  releaseDate?: string;
  series?: { title: string };
}

/**
 * Shared behavior for the Sonarr/Radarr/Lidarr family: same auth header
 * (`X-Api-Key`) and the same overall REST shape (system/status, queue,
 * calendar, rootfolder, qualityprofile), verified against real running
 * instances of all three. The API *version segment* differs per service
 * (Sonarr/Radarr are on `v3`, Lidarr is still on `v1`), so subclasses
 * declare `apiVersion`. Resource-specific behavior (search/add, since the
 * payload shape genuinely differs between series/movie/artist) is left
 * abstract for each subclass to implement against its own verified contract.
 */
export abstract class ServarrClient implements MediaServiceClient {
  abstract readonly id: ServiceId;
  abstract readonly label: string;
  abstract readonly mediaType: string;
  protected abstract readonly apiVersion: "v3" | "v1";

  private rootFolderCache: string | null = null;
  private qualityProfileCache: number | null = null;

  constructor(protected readonly config: ServarrClientConfig) {}

  protected request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/api/${this.apiVersion}${path}`;
    return fetchJson<T>(url, {
      ...init,
      headers: {
        "X-Api-Key": this.config.apiKey,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  }

  async healthCheck(): Promise<ServiceHealth> {
    try {
      const status = await this.request<{ version: string }>("/system/status");
      return { status: "up", version: status.version };
    } catch (err) {
      return { status: "down", message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getQueue(): Promise<QueueItem[]> {
    const data = await this.request<{ records: RawQueueRecord[] }>("/queue");
    return data.records.map((r) => ({
      id: String(r.id),
      title: r.title ?? r.series?.title ?? r.movie?.title ?? r.artist?.artistName ?? "Unknown",
      status: r.status,
      progress:
        r.size && r.size > 0 ? Math.round(((r.size - (r.sizeleft ?? 0)) / r.size) * 100) : null,
      timeLeft: r.timeleft ?? null,
    }));
  }

  async getCalendar(start: Date, end: Date): Promise<CalendarItem[]> {
    const qs = new URLSearchParams({ start: isoDate(start), end: isoDate(end) });
    const items = await this.request<RawCalendarRecord[]>(`/calendar?${qs}`);
    return items.map((item) => ({
      id: String(item.id),
      title: item.series?.title ?? item.title ?? "Unknown",
      date: item.airDateUtc ?? item.inCinemas ?? item.releaseDate ?? new Date().toISOString(),
      mediaType: this.mediaType,
    }));
  }

  /** First configured root folder. A real deployment may want an admin-selectable folder; the MVP uses whatever the service already has configured. */
  protected async getDefaultRootFolder(): Promise<string> {
    if (this.rootFolderCache) return this.rootFolderCache;
    const folders = await this.request<{ path: string }[]>("/rootfolder");
    if (folders.length === 0) {
      throw new ServiceRequestError(`${this.label} has no root folder configured`);
    }
    this.rootFolderCache = folders[0].path;
    return this.rootFolderCache;
  }

  protected async getDefaultQualityProfileId(): Promise<number> {
    if (this.qualityProfileCache) return this.qualityProfileCache;
    const profiles = await this.request<{ id: number }[]>("/qualityprofile");
    if (profiles.length === 0) {
      throw new ServiceRequestError(`${this.label} has no quality profile configured`);
    }
    this.qualityProfileCache = profiles[0].id;
    return this.qualityProfileCache;
  }

  abstract search(query: string): Promise<SearchResult[]>;
  abstract addItem(externalId: string, selection?: RequestSelection): Promise<void>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
