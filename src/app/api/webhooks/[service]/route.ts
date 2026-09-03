import { NextResponse } from "next/server";
import { SERVICE_IDS, type ServiceId } from "@/env";
import * as repo from "@/lib/db/repository";
import { logger } from "@/lib/logger";

function isServiceId(value: string): value is ServiceId {
  return (SERVICE_IDS as readonly string[]).includes(value);
}

/**
 * Extracts the external id a webhook payload refers to, so it can be
 * matched against `requests.external_id`. Verified by triggering each
 * service's real `/notification/test` endpoint against a live container and
 * inspecting the payload actually received: Sonarr sends `series.tvdbId`,
 * Radarr sends `movie.tmdbId` (falling back to `remoteMovie.tmdbId`, which
 * is what's populated in Radarr's own synthetic test payload), and Lidarr
 * sends `artist.mbId`.
 */
function extractExternalId(service: ServiceId, payload: Record<string, unknown>): string | null {
  switch (service) {
    case "sonarr": {
      const series = payload.series as Record<string, unknown> | undefined;
      return series?.tvdbId != null ? String(series.tvdbId) : null;
    }
    case "radarr": {
      const movie = payload.movie as Record<string, unknown> | undefined;
      const remoteMovie = payload.remoteMovie as Record<string, unknown> | undefined;
      const tmdbId = movie?.tmdbId || remoteMovie?.tmdbId;
      return tmdbId != null ? String(tmdbId) : null;
    }
    case "lidarr": {
      const artist = payload.artist as Record<string, unknown> | undefined;
      return artist?.mbId != null ? String(artist.mbId) : null;
    }
    default:
      return null;
  }
}

/**
 * Sonarr/Radarr both name this toggle `onDownload` and fire
 * `eventType: "Download"` on a completed import (verified via each
 * service's real API). Lidarr's equivalent toggle is named
 * `onReleaseImport` instead — its actual eventType string on a real import
 * couldn't be captured here (the synthetic `/notification/test` payload
 * always reports `eventType: "Test"` regardless of which toggle fired it,
 * and producing a real completed import needs an actual indexer/download
 * client), so both plausible names are accepted defensively. Re-verify
 * against a real Lidarr import before removing either.
 */
const FULFILLMENT_EVENT_TYPES = new Set(["Download", "ReleaseImport", "AlbumImport"]);

export async function POST(request: Request, { params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  if (!isServiceId(service)) {
    return NextResponse.json({ error: "Unknown service" }, { status: 404 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const eventType = typeof payload.eventType === "string" ? payload.eventType : "Unknown";
  await repo.createServiceEvent({ service, eventType, rawPayload: JSON.stringify(payload) });
  logger.info({ service, eventType }, "received webhook");

  if (FULFILLMENT_EVENT_TYPES.has(eventType)) {
    const externalId = extractExternalId(service, payload);
    if (externalId) {
      const matched = await repo.findApprovedRequest(service, externalId);
      if (matched) {
        await repo.markRequestFulfilled(matched.id);
        logger.info({ service, requestId: matched.id }, "request fulfilled by webhook");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
