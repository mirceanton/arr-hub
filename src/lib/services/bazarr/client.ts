import type { ServiceId } from "@/env";
import { fetchJson } from "../http";
import type { MediaServiceClient, ServiceHealth } from "../types";

export interface BazarrClientConfig {
  baseUrl: string;
  apiKey: string;
}

interface BazarrStatusResponse {
  data: { bazarr_version: string };
}

export interface BazarrBadges {
  episodes: number;
  movies: number;
  providers: number;
  status: number;
  sonarrSignalr: string;
  radarrSignalr: string;
}

/**
 * Bazarr manages subtitles for items that already exist in Sonarr/Radarr —
 * it has nothing to search or add on its own, so it only implements the
 * `healthCheck` half of MediaServiceClient (the required half), plus a
 * Bazarr-specific badges accessor used by the dashboard.
 *
 * Verified against a live linuxserver/bazarr container: its REST API is
 * meaningfully different from the Sonarr/Radarr/Lidarr family — no version
 * segment (`/api/...`, not `/api/v3/...`), responses wrapped in a `data`
 * envelope with snake_case fields, though it does share the same
 * `X-Api-Key` header convention.
 */
export class BazarrClient implements MediaServiceClient {
  readonly id: ServiceId = "bazarr";
  readonly label = "Bazarr";
  readonly mediaType = "subtitles";

  constructor(private readonly config: BazarrClientConfig) {}

  private request<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/api${path}`;
    return fetchJson<T>(url, { headers: { "X-Api-Key": this.config.apiKey } });
  }

  async healthCheck(): Promise<ServiceHealth> {
    try {
      const status = await this.request<BazarrStatusResponse>("/system/status");
      return { status: "up", version: status.data.bazarr_version };
    } catch (err) {
      return { status: "down", message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getBadges(): Promise<BazarrBadges> {
    const raw = await this.request<{
      episodes: number;
      movies: number;
      providers: number;
      status: number;
      sonarr_signalr: string;
      radarr_signalr: string;
    }>("/badges");
    return {
      episodes: raw.episodes,
      movies: raw.movies,
      providers: raw.providers,
      status: raw.status,
      sonarrSignalr: raw.sonarr_signalr,
      radarrSignalr: raw.radarr_signalr,
    };
  }
}
