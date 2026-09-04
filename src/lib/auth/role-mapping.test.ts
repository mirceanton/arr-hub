import { describe, expect, it } from "vitest";
import { resolveDefaultRoleFromGroups } from "./role-mapping";

describe("resolveDefaultRoleFromGroups", () => {
  it("maps a known group (with leading slash, as Keycloak's full-path mapper sends it)", () => {
    expect(resolveDefaultRoleFromGroups(["/arr-admin"])).toBe("admin");
    expect(resolveDefaultRoleFromGroups(["/arr-requester"])).toBe("requester");
  });

  it("matches case-insensitively and without a leading slash", () => {
    expect(resolveDefaultRoleFromGroups(["Arr-Admin"])).toBe("admin");
  });

  it("falls back to viewer when no group matches or the list is empty", () => {
    expect(resolveDefaultRoleFromGroups([])).toBe("viewer");
    expect(resolveDefaultRoleFromGroups(["/some-other-group"])).toBe("viewer");
  });

  it("uses the first matching group when a user is in several", () => {
    expect(resolveDefaultRoleFromGroups(["/some-other-group", "/arr-admin"])).toBe("admin");
  });
});
