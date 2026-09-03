import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BazarrClient } from "./client";

const BASE_URL = "http://fake-bazarr.test";

const server = setupServer(
  http.get(`${BASE_URL}/api/system/status`, () =>
    HttpResponse.json({ data: { bazarr_version: "1.6.0" } }),
  ),
  http.get(`${BASE_URL}/api/badges`, () =>
    HttpResponse.json({
      episodes: 3,
      movies: 1,
      providers: 0,
      status: 1,
      sonarr_signalr: "UP",
      radarr_signalr: "DOWN",
      announcements: 5,
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("BazarrClient (mocked HTTP, non-Servarr response shape)", () => {
  const client = new BazarrClient({ baseUrl: BASE_URL, apiKey: "test-key" });

  it("unwraps the `data` envelope to get the version", async () => {
    await expect(client.healthCheck()).resolves.toEqual({ status: "up", version: "1.6.0" });
  });

  it("reports down when the status endpoint fails", async () => {
    server.use(http.get(`${BASE_URL}/api/system/status`, () => new HttpResponse(null, { status: 500 })));
    const health = await client.healthCheck();
    expect(health.status).toBe("down");
  });

  it("maps snake_case badge fields to camelCase", async () => {
    await expect(client.getBadges()).resolves.toEqual({
      episodes: 3,
      movies: 1,
      providers: 0,
      status: 1,
      sonarrSignalr: "UP",
      radarrSignalr: "DOWN",
    });
  });

  it("calls the unversioned /api path, not /api/v3", async () => {
    let requestedUrl = "";
    server.use(
      http.get(`${BASE_URL}/api/system/status`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ data: { bazarr_version: "1.6.0" } });
      }),
    );
    await client.healthCheck();
    expect(requestedUrl).not.toContain("/api/v3");
    expect(requestedUrl).not.toContain("/api/v1");
  });
});
