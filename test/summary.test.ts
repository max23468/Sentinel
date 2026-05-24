import { describe, expect, it } from "vitest";
import { formatScanSummary } from "../src/summary.js";
import type { ScanResult } from "../src/types.js";

function baseResult(overrides: Partial<ScanResult>): ScanResult {
  return {
    siteId: "ortix",
    siteName: "Ortix",
    scannedAt: "2026-05-24T00:00:00.000Z",
    baseline: false,
    dryRun: false,
    scannedCount: 2,
    skippedCount: 0,
    changes: [],
    issues: [],
    emailSent: false,
    emailRequired: false,
    ...overrides
  };
}

describe("scan summary", () => {
  it("mostra sempre i problemi fatali prima degli avvisi", () => {
    const lines = formatScanSummary(
      baseResult({
        issues: [
          { url: "https://example.com/a", message: "HTTP 404", fatal: false },
          { url: "email", message: "Password SMTP assente", fatal: true }
        ]
      })
    );

    expect(lines[0]).toContain("1 fatali");
    expect(lines[1]).toBe("- FATALE email: Password SMTP assente");
    expect(lines[2]).toBe("- Avviso https://example.com/a: HTTP 404");
  });
});
