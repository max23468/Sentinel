import { describe, expect, it } from "vitest";
import { buildDashboardModel, parseScanReportSummary, renderDashboardHtml } from "../src/dashboard.js";
import type { SentinelConfig, SentinelState } from "../src/types.js";

const config: SentinelConfig = {
  version: 1,
  storage: {
    dataDir: "data",
    snapshotsDir: "snapshots",
    reportsDir: "reports"
  },
  email: {
    enabled: true,
    defaultProfile: "gmail",
    fromEnv: "SENTINEL_EMAIL_FROM",
    toEnv: "SENTINEL_EMAIL_TO",
    subjectPrefix: "[Sentinel]",
    profiles: {}
  },
  sites: [
    {
      id: "ortix",
      name: "Ortix",
      enabled: true,
      sitemapUrls: ["https://www.ortix.it/sitemap_index.xml"],
      roots: ["https://www.ortix.it/"],
      crawl: {
        maxDepth: 3,
        maxUrls: 500,
        timeoutMs: 30000,
        userAgent: "Sentinel test"
      },
      includeFileExtensions: ["pdf"],
      trackingParams: [],
      ignoredIssues: []
    }
  ]
};

const state: SentinelState = {
  version: 1,
  sites: {
    ortix: {
      id: "ortix",
      name: "Ortix",
      lastScanAt: "2026-05-24T18:55:55.372Z",
      urls: {
        home: {
          url: "https://www.ortix.it/",
          kind: "html",
          firstSeenAt: "2026-05-24T18:55:50.000Z",
          lastSeenAt: "2026-05-24T18:55:55.000Z",
          lastStatus: 200,
          hash: "abc",
          title: "Ortix <home>",
          snapshotIds: ["ortix/home/20260524T185555Z.json"]
        },
        brochure: {
          url: "https://www.ortix.it/brochure.pdf",
          kind: "file",
          firstSeenAt: "2026-05-24T18:55:51.000Z",
          lastSeenAt: "2026-05-24T18:56:55.000Z",
          lastStatus: 200,
          hash: "def",
          snapshotIds: []
        }
      }
    }
  }
};

describe("dashboard", () => {
  it("estrae la sintesi da un report di scansione", () => {
    const summary = parseScanReportSummary(
      "ortix",
      "/tmp/reports/ortix-20260524T185555Z.md",
      "ortix-20260524T185555Z.md",
      `# Report Sentinel - Ortix

- Scansione: 24 mag 2026, 20:55
- Modalità: operativa
- Baseline iniziale: no
- URL scansionati: 222
- URL saltati: 0
- Cambiamenti: 3
- Problemi: 2
- Avvisi noti: 1
- Email richiesta: sì
- Email inviata: no

## Problemi

- FATALE: email - Password SMTP assente
- Avviso: https://example.com/a - HTTP 404

## Avvisi noti

- Noto: https://example.com/legacy.jpg - HTTP 404 - Asset legacy
`
    );

    expect(summary.siteName).toBe("Ortix");
    expect(summary.changesCount).toBe(3);
    expect(summary.issuesCount).toBe(2);
    expect(summary.emailRequired).toBe(true);
    expect(summary.emailSent).toBe(false);
    expect(summary.fatalCount).toBe(1);
    expect(summary.issues).toHaveLength(2);
    expect(summary.issues[0]).toMatchObject({
      severity: "fatal",
      url: "email",
      message: "Password SMTP assente"
    });
    expect(summary.issues[1]).toMatchObject({
      severity: "warning",
      url: "https://example.com/a",
      message: "HTTP 404"
    });
    expect(summary.knownIssuesCount).toBe(1);
    expect(summary.knownIssues[0]).toMatchObject({
      severity: "known",
      url: "https://example.com/legacy.jpg",
      message: "HTTP 404",
      reason: "Asset legacy"
    });
  });

  it("renderizza una dashboard HTML con dati aggregati e valori escapati", () => {
    const report = parseScanReportSummary(
      "ortix",
      "/tmp/reports/ortix-20260524T185555Z.md",
      "ortix-20260524T185555Z.md",
      `# Report Sentinel - Ortix

- Scansione: 24 mag 2026, 20:55
- Modalità: operativa
- Baseline iniziale: no
- URL scansionati: 2
- URL saltati: 0
- Cambiamenti: 0
- Problemi: 0
- Avvisi noti: 0
- Email richiesta: no
- Email inviata: no
`
    );
    const model = buildDashboardModel(config, state, [report], "2026-05-26T09:00:00.000Z");
    const html = renderDashboardHtml(model);

    expect(html).toContain("<title>Sentinel dashboard</title>");
    expect(html).toContain("<strong>2</strong>");
    expect(html).toContain("Ortix &lt;home&gt;");
    expect(html).toContain("ortix-20260524T185555Z.md");
    expect(html).toContain("Stabile");
    expect(html).not.toContain('data-dashboard-button="html"');
    expect(html).toContain('data-dashboard-button="issues"');
    expect(html).toContain('data-dashboard-button="known"');
    expect(html).toContain('id="dashboard-results"');
  });
});
