import { describe, expect, it } from "vitest";
import { formatItalianDateTime, timestampForFile } from "../src/time.js";

describe("time helpers", () => {
  it("compatta i timestamp in formato file-safe", () => {
    expect(timestampForFile(new Date("2026-06-02T10:11:12.345Z"))).toBe("20260602T101112Z");
  });

  it("formatta la data nel fuso Europe/Rome", () => {
    const formatted = formatItalianDateTime("2026-06-02T08:30:00.000Z");

    expect(formatted).toMatch(/10:30/);
    expect(formatted).not.toMatch(/08:30/);
  });
});
