import type { ServiceId } from "@/env";
import type { SearchResult } from "../types";
import { ServarrClient } from "./base-client";

interface RadarrMovie {
  title: string;
  year?: number;
  overview?: string;
  tmdbId: number;
  titleSlug: string;
  remotePoster?: string;
  images: { coverType: string; remoteUrl?: string }[];
}

/** Verified against a live linuxserver/radarr container: /api/v3, X-Api-Key header, dedicated `/movie/lookup/tmdb?tmdbId=` for exact lookup (returns a single object, not an array). */
export class RadarrClient extends ServarrClient {
  readonly id: ServiceId = "radarr";
  readonly label = "Radarr";
  readonly mediaType = "movie";
  protected readonly apiVersion = "v3" as const;

  async search(query: string): Promise<SearchResult[]> {
    const results = await this.request<RadarrMovie[]>(
      `/movie/lookup?term=${encodeURIComponent(query)}`,
    );
    return results.map(toSearchResult);
  }

  async addItem(externalId: string): Promise<void> {
    const [rootFolderPath, qualityProfileId] = await Promise.all([
      this.getDefaultRootFolder(),
      this.getDefaultQualityProfileId(),
    ]);
    const lookup = await this.request<RadarrMovie>(`/movie/lookup/tmdb?tmdbId=${externalId}`);
    if (!lookup) throw new Error(`Radarr: no movie found for tmdbId ${externalId}`);
    await this.request("/movie", {
      method: "POST",
      body: JSON.stringify({
        title: lookup.title,
        titleSlug: lookup.titleSlug,
        tmdbId: lookup.tmdbId,
        year: lookup.year,
        images: lookup.images,
        qualityProfileId,
        rootFolderPath,
        monitored: true,
        minimumAvailability: "announced",
        addOptions: { searchForMovie: true },
      }),
    });
  }
}

function toSearchResult(r: RadarrMovie): SearchResult {
  return {
    externalId: String(r.tmdbId),
    title: r.title,
    year: r.year,
    overview: r.overview,
    posterUrl: r.remotePoster ?? r.images.find((i) => i.coverType === "poster")?.remoteUrl,
    mediaType: "movie",
  };
}
