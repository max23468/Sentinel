import { describe, expect, it } from "vitest";
import { renderInventoryReport, renderScanReport } from "../src/report.js";
import type { ScanResult, SentinelState } from "../src/types.js";

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

  it("aggiunge la sintesi baseline e rende tutti i tipi di cambiamento", () => {
    const report = renderScanReport(
      baseResult({
        baseline: true,
        changes: [
          { type: "added", url: "https://example.com/a", title: "Nuova pagina" },
          { type: "changed", url: "https://example.com/b" },
          { type: "removed", url: "https://example.com/c" }
        ]
      })
    );

    expect(report).toContain("Baseline iniziale creata. Nessuna email inviata per policy.");
    expect(report).toContain("- Aggiunto: https://example.com/a - Nuova pagina");
    expect(report).toContain("- Modificato: https://example.com/b");
    expect(report).toContain("- Rimosso: https://example.com/c");
  });

  it("riporta lo stato stabile quando non ci sono cambiamenti o problemi", () => {
    const report = renderScanReport(baseResult({}));

    expect(report).toContain("Nessun cambiamento o problema attivo rilevato.");
    expect(report).toContain("Nessun problema rilevato.");
    expect(report).toContain("Nessun avviso noto rilevato.");
  });

  it("genera un inventario ordinato e mostra \"mai\" senza scansioni precedenti", () => {
    const state: SentinelState = {
      version: 1,
      sites: {
        ortix: {
          id: "ortix",
          name: "Ortix",
          urls: {
            b: {
              url: "https://example.com/b",
              kind: "file",
              firstSeenAt: "2026-05-24T00:00:00.000Z",
              lastSeenAt: "2026-05-24T00:00:00.000Z",
              lastStatus: 200,
              hash: "b",
              snapshotIds: []
            },
            a: {
              url: "https://example.com/a",
              kind: "html",
              firstSeenAt: "2026-05-24T00:00:00.000Z",
              lastSeenAt: "2026-05-24T00:00:00.000Z",
              lastStatus: 200,
              hash: "a",
              snapshotIds: []
            }
          }
        }
      }
    };

    const report = renderInventoryReport(state, "2026-06-02T08:30:00.000Z");

    expect(report).toContain("- Ultima scansione: mai");
    expect(report.indexOf("- HTML https://example.com/a")).toBeLessThan(report.indexOf("- FILE https://example.com/b"));
  });
});
