import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ProwlarrClient } from "./client";

const BASE_URL = "http://fake-prowlarr.test";

const server = setupServer(
  http.get(`${BASE_URL}/api/v1/system/status`, () => HttpResponse.json({ version: "2.6.3.5592" })),
  http.get(`${BASE_URL}/api/v1/indexer`, () =>
    HttpResponse.json([
      { id: 1, name: "1337x", protocol: "torrent", privacy: "public", enable: true, priority: 25 },
      { id: 2, name: "NZBgeek", protocol: "usenet", privacy: "private", enable: false, priority: 25 },
    ]),
  ),
  http.get(`${BASE_URL}/api/v1/indexerstatus`, () =>
    HttpResponse.json([{ indexerId: 1, disabledTill: "2099-01-01T00:00:00Z" }]),
  ),
  http.get(`${BASE_URL}/api/v1/history`, () =>
    HttpResponse.json({
      page: 1,
      pageSize: 25,
      sortKey: "date",
      sortDirection: "descending",
      totalRecords: 1,
      records: [
        {
          id: 10,
          indexer: "1337x",
          title: "Some.Release.1080p",
          date: "2026-09-01T12:00:00Z",
          eventType: "releaseGrabbed",
          successful: true,
        },
      ],
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ProwlarrClient (mocked HTTP)", () => {
  const client = new ProwlarrClient({ baseUrl: BASE_URL, apiKey: "test-key" });

  it("maps a healthy system/status response to ServiceHealth", async () => {
    await expect(client.healthCheck()).resolves.toEqual({ status: "up", version: "2.6.3.5592" });
  });

  it("reports down (not a thrown error) on a non-2xx response", async () => {
    server.use(http.get(`${BASE_URL}/api/v1/system/status`, () => new HttpResponse(null, { status: 500 })));
    const health = await client.healthCheck();
    expect(health.status).toBe("down");
    expect(health.message).toBeTruthy();
  });

  it("sends the API key as X-Api-Key, not a bearer token or query param", async () => {
    let receivedHeader: string | null = null;
    server.use(
      http.get(`${BASE_URL}/api/v1/system/status`, ({ request }) => {
        receivedHeader = request.headers.get("X-Api-Key");
        return HttpResponse.json({ version: "2.6.3.5592" });
      }),
    );
    await client.healthCheck();
    expect(receivedHeader).toBe("test-key");
  });

  it("merges /indexer with /indexerstatus, flagging a backed-off indexer as unhealthy", async () => {
    const indexers = await client.getIndexers();
    expect(indexers).toEqual([
      {
        id: "1",
        name: "1337x",
        protocol: "torrent",
        privacy: "public",
        enabled: true,
        priority: 25,
        healthy: false,
        disabledTill: "2099-01-01T00:00:00Z",
      },
      {
        id: "2",
        name: "NZBgeek",
        protocol: "usenet",
        privacy: "private",
        enabled: false,
        priority: 25,
        healthy: false,
        disabledTill: null,
      },
    ]);
  });

  it("treats an expired disabledTill as healthy again", async () => {
    server.use(
      http.get(`${BASE_URL}/api/v1/indexerstatus`, () =>
        HttpResponse.json([{ indexerId: 1, disabledTill: "2000-01-01T00:00:00Z" }]),
      ),
    );
    const [indexer] = await client.getIndexers();
    expect(indexer.healthy).toBe(true);
    expect(indexer.disabledTill).toBeNull();
  });

  it("maps history records, unwrapping the paginated envelope", async () => {
    const history = await client.getHistory();
    expect(history).toEqual([
      {
        id: "10",
        indexerName: "1337x",
        title: "Some.Release.1080p",
        date: "2026-09-01T12:00:00Z",
        eventType: "releaseGrabbed",
        successful: true,
      },
    ]);
  });

  it("requests the given page size and sorts by date descending", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(`${BASE_URL}/api/v1/history`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({ page: 1, pageSize: 5, sortKey: "date", sortDirection: "descending", totalRecords: 0, records: [] });
      }),
    );
    await client.getHistory(5);
    expect(capturedUrl!.searchParams.get("pageSize")).toBe("5");
    expect(capturedUrl!.searchParams.get("sortDirection")).toBe("descending");
  });
});
