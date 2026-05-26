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

  it("riporta quando un'email richiesta è stata inviata", () => {
    const report = renderScanReport(
      baseResult({
        emailRequired: true,
        emailSent: true
      })
    );

    expect(report).toContain("- Email richiesta: sì");
    expect(report).toContain("- Email inviata: sì");
  });

  it("compatta gli avvisi non fatali ripetitivi", () => {
    const report = renderScanReport(
      baseResult({
        issues: Array.from({ length: 12 }, (_, index) => ({
          url: `https://example.com/${index}.jpg`,
          message: "HTTP 404",
          fatal: false
        }))
      })
    );

    expect(report).toContain("- Avviso: https://example.com/9.jpg - HTTP 404");
    expect(report).not.toContain("- Avviso: https://example.com/10.jpg - HTTP 404");
    expect(report).toContain("- Altri avvisi HTTP 404: 2");
  });

  it("separa gli avvisi noti dai problemi attivi", () => {
    const report = renderScanReport(
      baseResult({
        issues: [
          { url: "https://example.com/a", message: "HTTP 404", fatal: false },
          {
            url: "https://example.com/legacy.jpg",
            message: "HTTP 404",
            fatal: false,
            ignored: true,
            ignoredReason: "Asset legacy"
          }
        ]
      })
    );

    expect(report).toContain("- Problemi: 1");
    expect(report).toContain("- Avvisi noti: 1");
    expect(report).toContain("## Avvisi noti");
    expect(report).toContain("- Noto: https://example.com/legacy.jpg - HTTP 404 - Asset legacy");
  });
});
