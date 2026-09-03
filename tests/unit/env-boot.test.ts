import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const BASE_ENV: Record<string, string> = {
  DATABASE_URL: "file:./data/boot-check-test.db",
  SESSION_SECRET: "a".repeat(32),
  OIDC_ISSUER_URL: "http://localhost:8080/realms/homelab",
  OIDC_CLIENT_ID: "arr-hub",
  OIDC_CLIENT_SECRET: "secret",
  OIDC_REDIRECT_URI: "http://localhost:3000/api/auth/callback",
  SONARR_URL: "http://localhost:8989",
  SONARR_API_KEY: "sonarr-key",
  RADARR_URL: "http://localhost:7878",
  RADARR_API_KEY: "radarr-key",
  LIDARR_URL: "http://localhost:8686",
  LIDARR_API_KEY: "lidarr-key",
  BAZARR_URL: "http://localhost:6767",
  BAZARR_API_KEY: "bazarr-key",
};

function runBootCheck(overrides: Record<string, string | undefined>) {
  // Start from a clean slate (only PATH/etc from the current process, not
  // this repo's real .env.local) so each case's env is exactly what it declares.
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    ...BASE_ENV,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return spawnSync("npx", ["tsx", "tests/fixtures/boot-check.ts"], {
    env: env as NodeJS.ProcessEnv,
    encoding: "utf-8",
  });
}

describe("env boot behavior", () => {
  it("boots cleanly and reports every service configured when all vars are set", () => {
    const result = runBootCheck({});
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim().split("\n").pop()!);
    expect(parsed.configuredServices.sort()).toEqual(["bazarr", "lidarr", "radarr", "sonarr"]);
  });

  it("refuses to start with a clear message when SESSION_SECRET is missing", () => {
    const result = runBootCheck({ SESSION_SECRET: undefined });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/SESSION_SECRET/);
  });

  it("boots cleanly and hides a service when only its env vars are unset", () => {
    const result = runBootCheck({ LIDARR_URL: undefined, LIDARR_API_KEY: undefined });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim().split("\n").pop()!);
    expect(parsed.configuredServices.sort()).toEqual(["bazarr", "radarr", "sonarr"]);
  });

  it("treats an empty-string value the same as an absent var (e.g. a blank .env line), not a validation error", () => {
    const result = runBootCheck({ LIDARR_URL: "", LIDARR_API_KEY: "" });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim().split("\n").pop()!);
    expect(parsed.configuredServices.sort()).toEqual(["bazarr", "radarr", "sonarr"]);
  });

  it("refuses to start when only one half of a service's URL/API key pair is set", () => {
    const result = runBootCheck({ RADARR_API_KEY: undefined });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/RADARR_URL and RADARR_API_KEY/);
  });
});
