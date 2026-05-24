import { describe, expect, it } from "vitest";
import { renderScanReport } from "../src/report.js";
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

describe("scan report", () => {
  it("mostra i problemi fatali prima degli avvisi", () => {
    const report = renderScanReport(
      baseResult({
        issues: [
          { url: "https://example.com/a", message: "HTTP 404", fatal: false },
          { url: "email", message: "Variabile ambiente mancante", fatal: true }
        ]
      })
    );

    expect(report.indexOf("- FATALE: email")).toBeLessThan(report.indexOf("- Avviso: https://example.com/a"));
  });
});
