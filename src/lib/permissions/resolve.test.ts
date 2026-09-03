import { describe, expect, it } from "vitest";
import { pickHighestRole, resolvePermission } from "./resolve";

describe("resolvePermission", () => {
  it("admin defaults to granted for every action", () => {
    for (const action of ["view", "request", "manage"] as const) {
      expect(resolvePermission({ role: "admin", overrides: [], service: "sonarr", action })).toBe(true);
    }
  });

  it("requester defaults to view+request granted, manage denied", () => {
    expect(
      resolvePermission({ role: "requester", overrides: [], service: "sonarr", action: "view" }),
    ).toBe(true);
    expect(
      resolvePermission({ role: "requester", overrides: [], service: "sonarr", action: "request" }),
    ).toBe(true);
    expect(
      resolvePermission({ role: "requester", overrides: [], service: "sonarr", action: "manage" }),
    ).toBe(false);
  });

  it("viewer defaults to view granted only", () => {
    expect(resolvePermission({ role: "viewer", overrides: [], service: "sonarr", action: "view" })).toBe(
      true,
    );
    expect(
      resolvePermission({ role: "viewer", overrides: [], service: "sonarr", action: "request" }),
    ).toBe(false);
    expect(
      resolvePermission({ role: "viewer", overrides: [], service: "sonarr", action: "manage" }),
    ).toBe(false);
  });

  it("an explicit override wins over the role default, in either direction", () => {
    // Viewer explicitly granted manage on radarr, despite the role default being false.
    expect(
      resolvePermission({
        role: "viewer",
        overrides: [{ service: "radarr", action: "manage", granted: true }],
        service: "radarr",
        action: "manage",
      }),
    ).toBe(true);

    // Admin explicitly denied request on lidarr, despite the role default being true.
    expect(
      resolvePermission({
        role: "admin",
        overrides: [{ service: "lidarr", action: "request", granted: false }],
        service: "lidarr",
        action: "request",
      }),
    ).toBe(false);
  });

  it("an override for a different service or action does not leak", () => {
    expect(
      resolvePermission({
        role: "viewer",
        overrides: [{ service: "radarr", action: "manage", granted: true }],
        service: "sonarr",
        action: "manage",
      }),
    ).toBe(false);

    expect(
      resolvePermission({
        role: "viewer",
        overrides: [{ service: "sonarr", action: "manage", granted: true }],
        service: "sonarr",
        action: "request",
      }),
    ).toBe(false);
  });
});

describe("pickHighestRole", () => {
  it("returns viewer when a user somehow has no roles", () => {
    expect(pickHighestRole([])).toBe("viewer");
  });

  it("picks the most privileged role among several", () => {
    expect(pickHighestRole(["viewer", "requester"])).toBe("requester");
    expect(pickHighestRole(["requester", "admin", "viewer"])).toBe("admin");
  });
});
