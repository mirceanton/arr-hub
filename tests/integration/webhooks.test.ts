/* eslint-disable @typescript-eslint/no-explicit-any -- reaching into db/schema internals for test-only cleanup */
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as webhookPost } from "@/app/api/webhooks/[service]/route";
import { db, schema } from "@/lib/db/client";
import * as repo from "@/lib/db/repository";

/**
 * These payloads are exact captures from triggering the real
 * `/notification/test` endpoint on live Sonarr/Radarr/Lidarr containers
 * (see docker-compose.test.md) — not hand-written guesses — with only
 * `eventType` and the matching external id overridden to simulate a real
 * completed download rather than a connection test.
 */
const SONARR_DOWNLOAD_PAYLOAD = {
  series: { id: 1, title: "Breaking Bad", path: "C:\\testpath", tvdbId: 81189, tvMazeId: 0, tmdbId: 0, type: "standard", year: 2008, tags: [] },
  episodes: [{ id: 123, episodeNumber: 1, seasonNumber: 1, title: "Pilot", seriesId: 0, tvdbId: 0 }],
  eventType: "Download",
  instanceName: "Sonarr",
  applicationUrl: "",
};

const RADARR_DOWNLOAD_PAYLOAD = {
  movie: { id: 1, title: "Inception", year: 2010, folderPath: "C:\\testpath", tmdbId: 27205, tags: [] },
  remoteMovie: { tmdbId: 27205, imdbId: "tt1375666", title: "Inception", year: 2010 },
  release: { quality: "Test Quality", releaseGroup: "Test Group", indexer: "Test Indexer", size: 1 },
  eventType: "Download",
  instanceName: "Radarr",
  applicationUrl: "",
};

async function cleanupUser(userId: string) {
  const anyDb = db as any;
  const s = schema as any;
  await anyDb.delete(s.requests).where(eq(s.requests.userId, userId));
  await anyDb.delete(s.requests).where(eq(s.requests.decidedBy, userId));
  await anyDb.delete(s.userRoles).where(eq(s.userRoles.userId, userId));
  await anyDb.delete(s.users).where(eq(s.users.id, userId));
}

async function cleanupServiceEvents(service: string) {
  const anyDb = db as any;
  const s = schema as any;
  await anyDb.delete(s.serviceEvents).where(eq(s.serviceEvents.service, service));
}

/**
 * Deletes any pre-existing requests for this exact (service, externalId)
 * pair, regardless of which user created them. Without this, a request left
 * over from unrelated manual testing against the same dev database (e.g.
 * exercising the UI by hand) can collide with `findApprovedRequest`'s
 * `.limit(1)` lookup and cause it to flip the wrong row to fulfilled.
 */
async function clearRequestsFor(service: string, externalId: string) {
  const anyDb = db as any;
  const s = schema as any;
  await anyDb
    .delete(s.requests)
    .where(and(eq(s.requests.service, service), eq(s.requests.externalId, externalId)));
}

function postWebhook(service: string, payload: unknown) {
  const request = new Request(`http://localhost/api/webhooks/${service}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return webhookPost(request, { params: Promise.resolve({ service }) });
}

describe("Webhook receiver (real captured payload shapes)", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await repo.createUser({
      oidcSubject: `webhook-test-${crypto.randomUUID()}`,
      email: "webhook-test@example.com",
      displayName: "Webhook Test User",
    });
    userId = user.id;
  });

  afterAll(async () => {
    await cleanupUser(userId);
    await cleanupServiceEvents("sonarr");
    await cleanupServiceEvents("radarr");
  });

  it("rejects an unknown service with 404", async () => {
    const res = await postWebhook("not-a-real-service", { eventType: "Test" });
    expect(res.status).toBe(404);
  });

  it("records every webhook call as a service_event regardless of event type", async () => {
    const before = await repo.listRecentServiceEvents(["sonarr", "radarr", "lidarr", "bazarr"], 1000);
    await postWebhook("sonarr", { eventType: "Grab", series: { tvdbId: 81189 } });
    const after = await repo.listRecentServiceEvents(["sonarr", "radarr", "lidarr", "bazarr"], 1000);
    expect(after.length).toBe(before.length + 1);
    expect(after[0].eventType).toBe("Grab");
  });

  it("flips a matching approved Sonarr request to fulfilled on a real Download payload", async () => {
    await clearRequestsFor("sonarr", "81189");
    const created = await repo.createRequest({
      userId,
      service: "sonarr",
      externalId: "81189",
      title: "Breaking Bad",
      mediaType: "series",
    });
    await repo.decideRequest(created.id, { status: "approved", decidedBy: userId });

    const res = await postWebhook("sonarr", SONARR_DOWNLOAD_PAYLOAD);
    expect(res.status).toBe(200);

    const updated = await repo.getRequestById(created.id);
    expect(updated?.status).toBe("fulfilled");
  });

  it("flips a matching approved Radarr request to fulfilled using the remoteMovie.tmdbId fallback", async () => {
    await clearRequestsFor("radarr", "27205");
    const created = await repo.createRequest({
      userId,
      service: "radarr",
      externalId: "27205",
      title: "Inception",
      mediaType: "movie",
    });
    await repo.decideRequest(created.id, { status: "approved", decidedBy: userId });

    const res = await postWebhook("radarr", RADARR_DOWNLOAD_PAYLOAD);
    expect(res.status).toBe(200);

    const updated = await repo.getRequestById(created.id);
    expect(updated?.status).toBe("fulfilled");
  });

  it("leaves a pending (not yet approved) request untouched by a Download event", async () => {
    const created = await repo.createRequest({
      userId,
      service: "sonarr",
      externalId: "81189",
      title: "Breaking Bad",
      mediaType: "series",
    });
    // Deliberately not approved.

    await postWebhook("sonarr", SONARR_DOWNLOAD_PAYLOAD);

    const updated = await repo.getRequestById(created.id);
    expect(updated?.status).toBe("pending");
  });
});
