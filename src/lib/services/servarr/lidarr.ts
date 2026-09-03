import type { ServiceId } from "@/env";
import type { SearchResult } from "../types";
import { ServarrClient } from "./base-client";
import { ServiceRequestError } from "../http";

interface LidarrArtist {
  artistName: string;
  overview?: string;
  foreignArtistId: string;
  remotePoster?: string;
  images: { coverType: string; remoteUrl?: string }[];
}

/**
 * Verified against a live linuxserver/lidarr container: crucially, Lidarr is
 * still on `/api/v1` (Sonarr/Radarr moved to v3) — hitting `/api/v3/...`
 * 404s. Exact lookup by external id uses `term=lidarr:<musicbrainz-id>`
 * (the external id here is a MusicBrainz UUID string, not a numeric id like
 * Sonarr/Radarr use). Adding an artist also requires a metadata profile id,
 * which Sonarr/Radarr don't have a concept of.
 */
export class LidarrClient extends ServarrClient {
  readonly id: ServiceId = "lidarr";
  readonly label = "Lidarr";
  readonly mediaType = "artist";
  protected readonly apiVersion = "v1" as const;

  private metadataProfileCache: number | null = null;

  async search(query: string): Promise<SearchResult[]> {
    const results = await this.request<LidarrArtist[]>(
      `/artist/lookup?term=${encodeURIComponent(query)}`,
    );
    return results.map(toSearchResult);
  }

  async addItem(externalId: string): Promise<void> {
    const [rootFolderPath, qualityProfileId, metadataProfileId] = await Promise.all([
      this.getDefaultRootFolder(),
      this.getDefaultQualityProfileId(),
      this.getDefaultMetadataProfileId(),
    ]);
    const [lookup] = await this.request<LidarrArtist[]>(
      `/artist/lookup?term=lidarr:${externalId}`,
    );
    if (!lookup) throw new Error(`Lidarr: no artist found for MusicBrainz id ${externalId}`);
    await this.request("/artist", {
      method: "POST",
      body: JSON.stringify({
        artistName: lookup.artistName,
        foreignArtistId: lookup.foreignArtistId,
        images: lookup.images,
        qualityProfileId,
        metadataProfileId,
        rootFolderPath,
        monitored: true,
        addOptions: { monitor: "all", searchForMissingAlbums: true },
      }),
    });
  }

  private async getDefaultMetadataProfileId(): Promise<number> {
    if (this.metadataProfileCache) return this.metadataProfileCache;
    const profiles = await this.request<{ id: number }[]>("/metadataprofile");
    if (profiles.length === 0) {
      throw new ServiceRequestError(`${this.label} has no metadata profile configured`);
    }
    this.metadataProfileCache = profiles[0].id;
    return this.metadataProfileCache;
  }
}

function toSearchResult(r: LidarrArtist): SearchResult {
  return {
    externalId: r.foreignArtistId,
    title: r.artistName,
    overview: r.overview,
    posterUrl: r.remotePoster ?? r.images.find((i) => i.coverType === "poster")?.remoteUrl,
    mediaType: "artist",
  };
}
