import type { ServiceId } from "@/env";

/** Per-service brand accent used for dots, borders, and progress bars across the UI. */
export const SERVICE_ACCENT: Record<ServiceId, string> = {
  sonarr: "#3b82f6",
  radarr: "#f97316",
  bazarr: "#a855f7",
  lidarr: "#14b8a6",
};

export function serviceAccent(id: string): string {
  return SERVICE_ACCENT[id as ServiceId] ?? "#8b5cf6";
}
