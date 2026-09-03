import { getServiceEnvConfig, SERVICE_IDS, type ServiceId } from "@/env";
import { BazarrClient } from "./bazarr/client";
import { ProwlarrClient } from "./prowlarr/client";
import { LidarrClient } from "./servarr/lidarr";
import { RadarrClient } from "./servarr/radarr";
import { SonarrClient } from "./servarr/sonarr";
import type { MediaServiceClient, ServiceHealth } from "./types";

interface ServiceDefinition {
  id: ServiceId;
  label: string;
  mediaType: string;
  createClient: (config: { baseUrl: string; apiKey: string }) => MediaServiceClient;
}

/**
 * The single place that knows about every media service the hub can talk
 * to. To add a new service (e.g. Shelfmark): add its id to SERVICE_IDS in
 * `env.ts`, implement a client satisfying MediaServiceClient, and add one
 * entry here — nothing else in the app (nav, dashboard, search, requests)
 * needs to change, since they all iterate over the registry.
 */
const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  { id: "sonarr", label: "Sonarr", mediaType: "series", createClient: (c) => new SonarrClient(c) },
  { id: "radarr", label: "Radarr", mediaType: "movie", createClient: (c) => new RadarrClient(c) },
  { id: "lidarr", label: "Lidarr", mediaType: "artist", createClient: (c) => new LidarrClient(c) },
  { id: "bazarr", label: "Bazarr", mediaType: "subtitles", createClient: (c) => new BazarrClient(c) },
  { id: "prowlarr", label: "Prowlarr", mediaType: "indexers", createClient: (c) => new ProwlarrClient(c) },
];

function buildRegistry(): Map<ServiceId, MediaServiceClient> {
  const registry = new Map<ServiceId, MediaServiceClient>();
  for (const def of SERVICE_DEFINITIONS) {
    const config = getServiceEnvConfig(def.id);
    if (config) registry.set(def.id, def.createClient(config));
  }
  return registry;
}

/** Built once at boot from env — a service with no URL/key configured is simply absent from this map. */
export const serviceRegistry = buildRegistry();

export function getConfiguredServiceIds(): ServiceId[] {
  return SERVICE_IDS.filter((id) => serviceRegistry.has(id));
}

export function getServiceClient(id: ServiceId): MediaServiceClient | undefined {
  return serviceRegistry.get(id);
}

/** Services that support the search → request → approve workflow (i.e. declare `search` and `addItem`). */
export function getRequestableServices(): MediaServiceClient[] {
  return [...serviceRegistry.values()].filter((c) => c.search && c.addItem);
}

export interface ServiceStatus {
  id: ServiceId;
  label: string;
  health: ServiceHealth;
}

/** Health-checks every configured service. Shared by the dashboard and the sidebar's service list. */
export async function getServiceStatuses(): Promise<ServiceStatus[]> {
  const clients = [...serviceRegistry.values()];
  const healths = await Promise.all(clients.map((c) => c.healthCheck()));
  return clients.map((c, i) => ({ id: c.id, label: c.label, health: healths[i] }));
}
