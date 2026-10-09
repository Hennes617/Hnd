import { describe, expect, it } from "vitest";
import { openapi, publicApiOrigin } from "../src/openapi.js";

describe("public API configuration", () => {
  it("uses valid HTTP origins for generated clients", () => {
    expect(publicApiOrigin("https://api.example.org/")).toBe(
      "https://api.example.org",
    );
    expect(publicApiOrigin("http://localhost:3001")).toBe(
      "http://localhost:3001",
    );
  });
  it("falls back to the current origin for invalid or credential-bearing URLs", () => {
    for (const value of [
      "",
      "not-a-url",
      "javascript:alert(1)",
      "https://name:password@example.org",
      "https://example.org/path",
      "https://example.org?key=value",
    ]) {
      expect(publicApiOrigin(value)).toBe("/");
    }
  });
  it("documents the catalogue verification fields returned by the API", () => {
    expect(openapi.components.schemas.Reservoir.properties).toHaveProperty(
      "capacityMillionM3",
    );
    expect(openapi.components.schemas.Reservoir.properties).toHaveProperty(
      "verifiedFields",
    );
    expect(openapi.components.schemas.Reservoir.properties).toHaveProperty(
      "verifiedAt",
    );
    expect(openapi.components.schemas.River.properties).toHaveProperty(
      "lengthKm",
    );
  });
});
