import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { SonarrClient } from "./sonarr";

const BASE_URL = "http://fake-sonarr.test";

const LOOKUP_RESULT = {
  title: "Breaking Bad",
  year: 2008,
  overview: "A chemistry teacher turns to crime.",
  tvdbId: 81189,
  titleSlug: "breaking-bad",
  remotePoster: "https://example.test/remote-poster.jpg",
  images: [{ coverType: "poster", remoteUrl: "https://example.test/poster.jpg" }],
};

const server = setupServer(
  http.get(`${BASE_URL}/api/v3/system/status`, () => HttpResponse.json({ version: "4.0.19.2979" })),
  http.get(`${BASE_URL}/api/v3/series/lookup`, () => HttpResponse.json([LOOKUP_RESULT])),
  http.get(`${BASE_URL}/api/v3/rootfolder`, () => HttpResponse.json([{ path: "/media" }])),
  http.get(`${BASE_URL}/api/v3/qualityprofile`, () => HttpResponse.json([{ id: 4, name: "HD-1080p" }])),
  http.post(`${BASE_URL}/api/v3/series`, () => HttpResponse.json({ id: 1 }, { status: 201 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("SonarrClient (mocked HTTP)", () => {
  const client = new SonarrClient({ baseUrl: BASE_URL, apiKey: "test-key" });

  it("maps a healthy system/status response to ServiceHealth", async () => {
    await expect(client.healthCheck()).resolves.toEqual({ status: "up", version: "4.0.19.2979" });
  });

  it("reports down (not a thrown error) on a non-2xx response", async () => {
    server.use(http.get(`${BASE_URL}/api/v3/system/status`, () => new HttpResponse(null, { status: 500 })));
    const health = await client.healthCheck();
    expect(health.status).toBe("down");
    expect(health.message).toBeTruthy();
  });

  it("sends the API key as X-Api-Key, not a bearer token or query param", async () => {
    let receivedHeader: string | null = null;
    server.use(
      http.get(`${BASE_URL}/api/v3/system/status`, ({ request }) => {
        receivedHeader = request.headers.get("X-Api-Key");
        return HttpResponse.json({ version: "4.0.19.2979" });
      }),
    );
    await client.healthCheck();
    expect(receivedHeader).toBe("test-key");
  });

  it("maps a series/lookup result to the common SearchResult shape", async () => {
    const [result] = await client.search("Breaking Bad");
    expect(result).toEqual({
      externalId: "81189",
      title: "Breaking Bad",
      year: 2008,
      overview: "A chemistry teacher turns to crime.",
      posterUrl: "https://example.test/remote-poster.jpg",
      mediaType: "series",
    });
  });

  it("falls back to the poster image's remoteUrl when remotePoster is absent", async () => {
    server.use(
      http.get(`${BASE_URL}/api/v3/series/lookup`, () =>
        HttpResponse.json([{ ...LOOKUP_RESULT, remotePoster: undefined }]),
      ),
    );
    const [result] = await client.search("Breaking Bad");
    expect(result.posterUrl).toBe("https://example.test/poster.jpg");
  });

  it("posts an add request using the discovered root folder and quality profile", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}/api/v3/series`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
    );
    await client.addItem("81189");
    expect(capturedBody).toMatchObject({
      title: "Breaking Bad",
      tvdbId: 81189,
      rootFolderPath: "/media",
      qualityProfileId: 4,
      monitored: true,
    });
  });
});
