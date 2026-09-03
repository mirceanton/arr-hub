import { describe, expect, it } from "vitest";
import { getServiceEnvConfig } from "@/env";
import { BazarrClient } from "@/lib/services/bazarr/client";
import { LidarrClient } from "@/lib/services/servarr/lidarr";
import { RadarrClient } from "@/lib/services/servarr/radarr";
import { SonarrClient } from "@/lib/services/servarr/sonarr";
import { servarrRequest } from "./helpers";

const sonarrConfig = getServiceEnvConfig("sonarr");
const radarrConfig = getServiceEnvConfig("radarr");
const lidarrConfig = getServiceEnvConfig("lidarr");
const bazarrConfig = getServiceEnvConfig("bazarr");

describe.skipIf(!sonarrConfig)("SonarrClient (live)", () => {
  const client = new SonarrClient(sonarrConfig!);

  it("reports up with a version", async () => {
    const health = await client.healthCheck();
    expect(health.status).toBe("up");
    expect(health.version).toBeTruthy();
  });

  it("searches by title and finds Breaking Bad's tvdbId", async () => {
    const results = await client.search("Breaking Bad");
    expect(results.some((r) => r.externalId === "81189")).toBe(true);
  });

  it("adds a series end-to-end then removes it", async () => {
    // Idempotent: a prior run that crashed before cleanup could leave this behind.
    const [preexisting] = await servarrRequest<{ id: number }[]>(
      sonarrConfig!.baseUrl,
      sonarrConfig!.apiKey,
      "v3",
      "/series?tvdbId=81189",
    );
    if (preexisting) {
      await servarrRequest(sonarrConfig!.baseUrl, sonarrConfig!.apiKey, "v3", `/series/${preexisting.id}`, {
        method: "DELETE",
      });
    }

    await client.addItem("81189");
    try {
      const [added] = await servarrRequest<{ id: number }[]>(
        sonarrConfig!.baseUrl,
        sonarrConfig!.apiKey,
        "v3",
        "/series?tvdbId=81189",
      );
      expect(added).toBeDefined();
    } finally {
      const [added] = await servarrRequest<{ id: number }[]>(
        sonarrConfig!.baseUrl,
        sonarrConfig!.apiKey,
        "v3",
        "/series?tvdbId=81189",
      );
      if (added) {
        await servarrRequest(sonarrConfig!.baseUrl, sonarrConfig!.apiKey, "v3", `/series/${added.id}`, {
          method: "DELETE",
        });
      }
    }
  });

  it("returns an empty queue on a fresh instance", async () => {
    await expect(client.getQueue()).resolves.toEqual([]);
  });
});

describe.skipIf(!radarrConfig)("RadarrClient (live)", () => {
  const client = new RadarrClient(radarrConfig!);

  it("reports up with a version", async () => {
    const health = await client.healthCheck();
    expect(health.status).toBe("up");
  });

  it("searches by title and finds Inception's tmdbId", async () => {
    const results = await client.search("Inception");
    expect(results.some((r) => r.externalId === "27205")).toBe(true);
  });

  it("adds a movie end-to-end then removes it", async () => {
    const [preexisting] = await servarrRequest<{ id: number }[]>(
      radarrConfig!.baseUrl,
      radarrConfig!.apiKey,
      "v3",
      "/movie?tmdbId=27205",
    );
    if (preexisting) {
      await servarrRequest(radarrConfig!.baseUrl, radarrConfig!.apiKey, "v3", `/movie/${preexisting.id}`, {
        method: "DELETE",
      });
    }

    await client.addItem("27205");
    try {
      const [added] = await servarrRequest<{ id: number }[]>(
        radarrConfig!.baseUrl,
        radarrConfig!.apiKey,
        "v3",
        "/movie?tmdbId=27205",
      );
      expect(added).toBeDefined();
    } finally {
      const [added] = await servarrRequest<{ id: number }[]>(
        radarrConfig!.baseUrl,
        radarrConfig!.apiKey,
        "v3",
        "/movie?tmdbId=27205",
      );
      if (added) {
        await servarrRequest(radarrConfig!.baseUrl, radarrConfig!.apiKey, "v3", `/movie/${added.id}`, {
          method: "DELETE",
        });
      }
    }
  });
});

describe.skipIf(!lidarrConfig)("LidarrClient (live, /api/v1)", () => {
  const client = new LidarrClient(lidarrConfig!);
  const radioheadMbid = "a74b1b7f-71a5-4011-9441-d0b5e4122711";

  it("reports up with a version", async () => {
    const health = await client.healthCheck();
    expect(health.status).toBe("up");
  });

  it("searches by name and finds Radiohead's MusicBrainz id", async () => {
    const results = await client.search("Radiohead");
    expect(results.some((r) => r.externalId === radioheadMbid)).toBe(true);
  });

  it("adds an artist end-to-end then removes it", async () => {
    const preexisting = await servarrRequest<{ id: number; foreignArtistId: string }[]>(
      lidarrConfig!.baseUrl,
      lidarrConfig!.apiKey,
      "v1",
      "/artist",
    );
    const stale = preexisting.find((a) => a.foreignArtistId === radioheadMbid);
    if (stale) {
      await servarrRequest(lidarrConfig!.baseUrl, lidarrConfig!.apiKey, "v1", `/artist/${stale.id}`, {
        method: "DELETE",
      });
    }

    await client.addItem(radioheadMbid);
    try {
      const all = await servarrRequest<{ id: number; foreignArtistId: string }[]>(
        lidarrConfig!.baseUrl,
        lidarrConfig!.apiKey,
        "v1",
        "/artist",
      );
      expect(all.some((a) => a.foreignArtistId === radioheadMbid)).toBe(true);
    } finally {
      const all = await servarrRequest<{ id: number; foreignArtistId: string }[]>(
        lidarrConfig!.baseUrl,
        lidarrConfig!.apiKey,
        "v1",
        "/artist",
      );
      const added = all.find((a) => a.foreignArtistId === radioheadMbid);
      if (added) {
        await servarrRequest(lidarrConfig!.baseUrl, lidarrConfig!.apiKey, "v1", `/artist/${added.id}`, {
          method: "DELETE",
        });
      }
    }
  });
});

describe.skipIf(!bazarrConfig)("BazarrClient (live, non-v3 API shape)", () => {
  const client = new BazarrClient(bazarrConfig!);

  it("reports up with a version parsed out of the data envelope", async () => {
    const health = await client.healthCheck();
    expect(health.status).toBe("up");
    expect(health.version).toBeTruthy();
  });

  it("fetches badges with snake_case fields mapped to camelCase", async () => {
    const badges = await client.getBadges();
    expect(typeof badges.episodes).toBe("number");
    expect(typeof badges.sonarrSignalr).toBe("string");
  });
});
