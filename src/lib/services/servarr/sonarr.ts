import type { ServiceId } from "@/env";
import type { SearchResult } from "../types";
import { ServarrClient } from "./base-client";

interface SonarrSeries {
  title: string;
  year?: number;
  overview?: string;
  tvdbId: number;
  titleSlug: string;
  remotePoster?: string;
  images: { coverType: string; remoteUrl?: string; url?: string }[];
}

/** Verified against a live linuxserver/sonarr container: /api/v3, X-Api-Key header, `term=tvdb:<id>` for exact lookup. */
export class SonarrClient extends ServarrClient {
  readonly id: ServiceId = "sonarr";
  readonly label = "Sonarr";
  readonly mediaType = "series";
  protected readonly apiVersion = "v3" as const;

  async search(query: string): Promise<SearchResult[]> {
    const results = await this.request<SonarrSeries[]>(
      `/series/lookup?term=${encodeURIComponent(query)}`,
    );
    return results.map(toSearchResult);
  }

  async addItem(externalId: string): Promise<void> {
    const [rootFolderPath, qualityProfileId] = await Promise.all([
      this.getDefaultRootFolder(),
      this.getDefaultQualityProfileId(),
    ]);
    const [lookup] = await this.request<SonarrSeries[]>(`/series/lookup?term=tvdb:${externalId}`);
    if (!lookup) throw new Error(`Sonarr: no series found for tvdbId ${externalId}`);
    await this.request("/series", {
      method: "POST",
      body: JSON.stringify({
        title: lookup.title,
        titleSlug: lookup.titleSlug,
        tvdbId: lookup.tvdbId,
        images: lookup.images,
        qualityProfileId,
        rootFolderPath,
        monitored: true,
        seasonFolder: true,
        addOptions: { searchForMissingEpisodes: true },
      }),
    });
  }
}

function toSearchResult(r: SonarrSeries): SearchResult {
  return {
    externalId: String(r.tvdbId),
    title: r.title,
    year: r.year,
    overview: r.overview,
    posterUrl: r.remotePoster ?? r.images.find((i) => i.coverType === "poster")?.remoteUrl,
    mediaType: "series",
  };
}
