import type { ServiceId } from "@/env";

/** Per-service brand accent used for dots, borders, and progress bars across the UI. */
export const SERVICE_ACCENT: Record<ServiceId, string> = {
  sonarr: "#3b82f6",
  radarr: "#f97316",
  bazarr: "#a855f7",
  lidarr: "#14b8a6",
  prowlarr: "#ec4899",
};

export function serviceAccent(id: string): string {
  return SERVICE_ACCENT[id as ServiceId] ?? "#8b5cf6";
}

/** Human-friendly media type, for surfaces where regular users shouldn't need to know which *arr service handles what. */
const MEDIA_TYPE_LABEL: Record<string, string> = {
  series: "TV Shows",
  movie: "Movies",
  artist: "Music",
  subtitles: "Subtitles",
  indexers: "Indexers",
};

export function mediaTypeLabel(mediaType: string): string {
  return MEDIA_TYPE_LABEL[mediaType] ?? mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
}
