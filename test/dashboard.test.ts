import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDashboardModel, parseScanReportSummary, readLatestReportSummaries, renderDashboardHtml } from "../src/dashboard.js";
import { dashboardBlobPrefix, dashboardModelBlobPath, dashboardReportBlobPath } from "../src/dashboard-publish.js";
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

function makeReport(
  siteId: string,
  siteName: string,
  overrides: {
    changes?: number;
    issues?: number;
    known?: number;
    problemLines?: string[];
    knownIssueLines?: string[];
    changeLines?: string[];
  } = {}
) {
  const problemLines = overrides.problemLines ?? ["- Nessun problema rilevato."];
  const knownIssueLines = overrides.knownIssueLines ?? ["- Nessun avviso noto rilevato."];
  const changeLines = overrides.changeLines ?? ["- Nessun cambiamento rilevato."];

  return parseScanReportSummary(
    siteId,
    `/tmp/reports/${siteId}-20260524T185555Z.md`,
    `${siteId}-20260524T185555Z.md`,
    `# Report Sentinel - ${siteName}

- Scansione: 24 mag 2026, 20:55
- Modalità: operativa
- Baseline iniziale: no
- URL scansionati: 2
- URL saltati: 0
- Cambiamenti: ${overrides.changes ?? 0}
- Problemi: ${overrides.issues ?? 0}
- Avvisi noti: ${overrides.known ?? 0}
- Email richiesta: no
- Email inviata: no

## Problemi

${problemLines.join("\n")}

## Avvisi noti

${knownIssueLines.join("\n")}

## Cambiamenti

${changeLines.join("\n")}
`
  );
}

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

  it("renderizza gli stati dei monitor e un empty state distinto per gli avvisi noti", () => {
    const multiConfig: SentinelConfig = {
      ...config,
      sites: [
        config.sites[0],
        { ...config.sites[0], id: "changes", name: "Changes" },
        { ...config.sites[0], id: "warnings", name: "Warnings" },
        { ...config.sites[0], id: "fatal", name: "Fatal" },
        { ...config.sites[0], id: "disabled", name: "Disabled", enabled: false },
        { ...config.sites[0], id: "noreport", name: "No Report" }
      ]
    };
    const multiState: SentinelState = {
      ...state,
      sites: {
        ortix: state.sites.ortix,
        changes: state.sites.ortix,
        warnings: state.sites.ortix,
        fatal: state.sites.ortix,
        disabled: state.sites.ortix,
        noreport: {
          id: "noreport",
          name: "No Report",
          urls: {}
        }
      }
    };
    const reports = [
      makeReport("ortix", "Ortix"),
      makeReport("changes", "Changes", {
        changes: 2,
        changeLines: ["- Modificato: https://example.com/change - Pagina aggiornata"]
      }),
      makeReport("warnings", "Warnings", {
        issues: 2,
        problemLines: ["- Avviso: https://example.com/warn - HTTP 404"]
      }),
      makeReport("fatal", "Fatal", {
        issues: 1,
        problemLines: ["- FATALE: email - Password SMTP assente"]
      })
    ];

    const model = buildDashboardModel(multiConfig, multiState, reports, "2026-05-26T09:00:00.000Z");
    const html = renderDashboardHtml(model);

    expect(html).toContain(">Stabile<");
    expect(html).toContain(">Cambiamenti<");
    expect(html).toContain(">Avvisi<");
    expect(html).toContain(">Errore<");
    expect(html).toContain(">Disabilitato<");
    expect(html).toContain(">Senza report<");
    expect(html).toContain("Nessun avviso noto negli ultimi report disponibili.");
  });

  it("degrada righe di report non standard in riepiloghi leggibili", () => {
    const summary = parseScanReportSummary(
      "ortix",
      "/tmp/reports/ortix-20260524T185555Z.md",
      "ortix-20260524T185555Z.md",
      `## Problemi

- Altri avvisi tecnici: 7
- Riga libera problema

## Avvisi noti

- Riga libera avviso noto

## Cambiamenti

- Nessun cambiamento rilevato.
`
    );

    expect(summary.siteName).toBe("ortix");
    expect(summary.issues).toEqual([
      {
        siteName: "ortix",
        severity: "summary",
        message: "Altri avvisi tecnici",
        count: 7
      },
      {
        siteName: "ortix",
        severity: "summary",
        message: "Riga libera problema"
      }
    ]);
    expect(summary.knownIssues).toEqual([
      {
        siteName: "ortix",
        severity: "summary",
        message: "Riga libera avviso noto"
      }
    ]);
    expect(summary.changes).toEqual([]);
  });

  it("normalizza i path usati per pubblicare il payload dinamico", () => {
    const previousPrefix = process.env.SENTINEL_DASHBOARD_BLOB_PREFIX;

    try {
      process.env.SENTINEL_DASHBOARD_BLOB_PREFIX = "/sentinel/test/";

      expect(dashboardBlobPrefix()).toBe("sentinel/test");
      expect(dashboardModelBlobPath()).toBe("sentinel/test/model.json");
      expect(dashboardReportBlobPath("../ortix-20260526T094354Z.md")).toBe("sentinel/test/reports/ortix-20260526T094354Z.md");
    } finally {
      if (previousPrefix === undefined) {
        delete process.env.SENTINEL_DASHBOARD_BLOB_PREFIX;
      } else {
        process.env.SENTINEL_DASHBOARD_BLOB_PREFIX = previousPrefix;
      }
    }
  });

  it("associa i report al site id esatto anche quando un id è prefisso di un altro", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sentinel-dashboard-"));
    const reportsDir = path.join(tempDir, "reports");
    await mkdir(reportsDir);

    await writeFile(
      path.join(reportsDir, "ortix-20260524T185555Z.md"),
      `# Report Sentinel - Ortix

- Scansione: 24 mag 2026, 20:55
- Modalità: operativa
- Baseline iniziale: no
- URL scansionati: 2
- URL saltati: 0
- Cambiamenti: 1
- Problemi: 0
- Avvisi noti: 0
- Email richiesta: no
- Email inviata: no
`,
      "utf8"
    );
    await writeFile(
      path.join(reportsDir, "ortix-extra-20260524T195555Z.md"),
      `# Report Sentinel - Ortix Extra

- Scansione: 24 mag 2026, 21:55
- Modalità: operativa
- Baseline iniziale: no
- URL scansionati: 8
- URL saltati: 0
- Cambiamenti: 9
- Problemi: 0
- Avvisi noti: 0
- Email richiesta: no
- Email inviata: no
`,
      "utf8"
    );

    const summaries = await readLatestReportSummaries(
      {
        ...config,
        storage: {
          ...config.storage,
          reportsDir
        },
        sites: [
          config.sites[0],
          {
            ...config.sites[0],
            id: "ortix-extra",
            name: "Ortix Extra"
          }
        ]
      },
      path.join(reportsDir, "dashboard.html")
    );

    expect(summaries.find((summary) => summary.siteId === "ortix")?.changesCount).toBe(1);
    expect(summaries.find((summary) => summary.siteId === "ortix-extra")?.changesCount).toBe(9);
  });
});
