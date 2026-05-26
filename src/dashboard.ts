import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SentinelConfig, SentinelState, SiteConfig, SiteState } from "./types.js";
import { ensureDir, resolveFromCwd } from "./fs.js";
import { formatItalianDateTime } from "./time.js";

interface DashboardOptions {
  createdAt?: string;
  outputPath?: string;
}

interface DashboardSite {
  id: string;
  name: string;
  enabled: boolean;
  lastScanAt?: string;
  totalUrls: number;
  htmlUrls: number;
  fileUrls: number;
  okUrls: number;
  warningUrls: number;
  errorUrls: number;
  snapshotCount: number;
  latestReport?: DashboardReportSummary;
}

interface DashboardIssue {
  siteName: string;
  severity: "fatal" | "warning" | "known" | "summary";
  url?: string;
  message: string;
  count?: number;
  reason?: string;
}

interface DashboardChange {
  siteName: string;
  type: string;
  url: string;
  title?: string;
}

interface RecentResource {
  siteName: string;
  url: string;
  kind: string;
  status: number;
  lastSeenAt: string;
  title?: string;
}

export interface DashboardReportSummary {
  siteId: string;
  siteName: string;
  filePath: string;
  linkHref: string;
  scanLabel?: string;
  mode?: string;
  baseline?: boolean;
  scannedCount?: number;
  skippedCount?: number;
  changesCount?: number;
  issuesCount?: number;
  knownIssuesCount?: number;
  emailRequired?: boolean;
  emailSent?: boolean;
  fatalCount: number;
  issues: DashboardIssue[];
  knownIssues: DashboardIssue[];
  changes: DashboardChange[];
}

interface DashboardModel {
  createdAt: string;
  sites: DashboardSite[];
  resources: RecentResource[];
  recentResources: RecentResource[];
  issues: DashboardIssue[];
  knownIssues: DashboardIssue[];
  changes: DashboardChange[];
  totals: {
    enabledSites: number;
    urls: number;
    htmlUrls: number;
    fileUrls: number;
    changes: number;
    issues: number;
    knownIssues: number;
  };
}

const DEFAULT_DASHBOARD_FILE = "dashboard.html";
const RECENT_RESOURCE_LIMIT = 12;

export async function writeDashboard(
  config: SentinelConfig,
  state: SentinelState,
  options: DashboardOptions = {}
): Promise<string> {
  const outputPath = resolveDashboardPath(config, options.outputPath);
  const reports = await readLatestReportSummaries(config, outputPath);
  const model = buildDashboardModel(config, state, reports, options.createdAt ?? new Date().toISOString());
  const html = renderDashboardHtml(model);

  await ensureDir(path.dirname(outputPath));
  await writeFile(outputPath, html, "utf8");

  return outputPath;
}

export function buildDashboardModel(
  config: SentinelConfig,
  state: SentinelState,
  reports: DashboardReportSummary[],
  createdAt: string
): DashboardModel {
  const reportsBySite = new Map(reports.map((report) => [report.siteId, report]));
  const sites = config.sites.map((site) => buildDashboardSite(site, state.sites[site.id], reportsBySite.get(site.id)));
  const resources = sites.flatMap((site) => collectRecentResources(site.name, state.sites[site.id]));
  const issues = reports.flatMap((report) => report.issues);
  const knownIssues = reports.flatMap((report) => report.knownIssues);
  const changes = reports.flatMap((report) => report.changes);

  return {
    createdAt,
    sites,
    resources,
    recentResources: resources
      .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
      .slice(0, RECENT_RESOURCE_LIMIT),
    issues,
    knownIssues,
    changes,
    totals: {
      enabledSites: sites.filter((site) => site.enabled).length,
      urls: sum(sites, "totalUrls"),
      htmlUrls: sum(sites, "htmlUrls"),
      fileUrls: sum(sites, "fileUrls"),
      changes: sites.reduce((total, site) => total + (site.latestReport?.changesCount ?? 0), 0),
      issues: sites.reduce((total, site) => total + (site.latestReport?.issuesCount ?? 0), 0),
      knownIssues: sites.reduce((total, site) => total + (site.latestReport?.knownIssuesCount ?? 0), 0)
    }
  };
}

export function renderDashboardHtml(model: DashboardModel): string {
  const title = "Sentinel dashboard";
  const generatedAt = formatItalianDateTime(model.createdAt);

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: oklch(98% 0.006 145);
      --panel: oklch(100% 0 0);
      --panel-soft: oklch(96.4% 0.009 145);
      --ink: oklch(23% 0.025 150);
      --muted: oklch(49% 0.025 150);
      --faint: oklch(68% 0.018 150);
      --line: oklch(88% 0.012 150);
      --accent: oklch(55% 0.12 158);
      --accent-soft: oklch(91% 0.052 158);
      --warn: oklch(71% 0.14 72);
      --warn-soft: oklch(93% 0.06 72);
      --danger: oklch(58% 0.18 28);
      --danger-soft: oklch(94% 0.042 28);
      --shadow: 0 16px 38px rgba(28, 45, 37, 0.08);
      --radius: 8px;
    }

    * { box-sizing: border-box; }

    html {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background: var(--bg);
      color: var(--ink);
      font-family: Aptos, "Segoe UI", ui-sans-serif, system-ui, sans-serif;
      font-variant-numeric: tabular-nums;
    }

    body {
      margin: 0;
      min-width: 320px;
    }

    a {
      color: inherit;
      text-decoration-color: color-mix(in oklch, var(--accent), transparent 42%);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }

    a:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
    }

    .page {
      margin: 0 auto;
      max-width: 1180px;
      padding: 32px 24px 44px;
    }

    .topbar {
      align-items: end;
      display: flex;
      gap: 20px;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
    }

    h1 {
      font-size: clamp(2rem, 4vw, 4rem);
      font-weight: 680;
      letter-spacing: -0.022em;
      line-height: 0.95;
      text-wrap: balance;
    }

    h2 {
      font-size: 1rem;
      font-weight: 680;
      letter-spacing: -0.012em;
    }

    .timestamp {
      color: var(--muted);
      font-size: 0.875rem;
      line-height: 1.5;
      text-align: right;
      text-wrap: pretty;
    }

    .metric-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      margin-bottom: 18px;
    }

    .metric {
      background: var(--panel);
      border: 0;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      color: inherit;
      cursor: pointer;
      font: inherit;
      min-height: 104px;
      padding: 15px 16px;
      text-align: left;
      transition: box-shadow 160ms ease, transform 160ms ease;
      width: 100%;
    }

    .metric span {
      color: var(--muted);
      display: block;
      font-size: 0.75rem;
      font-weight: 650;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .metric strong {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.022em;
      line-height: 1.1;
      margin-top: 16px;
    }

    .metric:hover,
    .metric[aria-pressed="true"] {
      box-shadow: 0 18px 44px rgba(28, 45, 37, 0.13);
      transform: translateY(-1px);
    }

    .metric:active {
      transform: scale(0.98);
    }

    .metric[aria-pressed="true"] {
      background: color-mix(in oklch, var(--accent-soft), white 52%);
    }

    .sites {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(${Math.max(1, Math.min(model.sites.length, 3))}, minmax(0, 1fr));
      margin-bottom: 20px;
    }

    .site-card,
    .panel {
      background: var(--panel);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .site-card {
      display: grid;
      gap: 18px;
      padding: 18px;
    }

    .site-header {
      align-items: start;
      display: flex;
      gap: 14px;
      justify-content: space-between;
    }

    .site-title {
      display: grid;
      gap: 5px;
    }

    .site-title h2 {
      font-size: 1.25rem;
    }

    .site-title p,
    .site-meta {
      color: var(--muted);
      font-size: 0.875rem;
      line-height: 1.45;
    }

    .badge {
      align-items: center;
      border-radius: 999px;
      display: inline-flex;
      font-size: 0.75rem;
      font-weight: 700;
      gap: 6px;
      justify-self: start;
      min-height: 28px;
      padding: 0 10px;
      white-space: nowrap;
    }

    .badge::before {
      border-radius: 50%;
      content: "";
      height: 7px;
      width: 7px;
    }

    .badge.stable,
    .badge.enabled {
      background: var(--accent-soft);
      color: oklch(35% 0.095 158);
    }

    .badge.stable::before,
    .badge.enabled::before {
      background: var(--accent);
    }

    .badge.warning,
    .badge.changed {
      background: var(--warn-soft);
      color: oklch(42% 0.1 72);
    }

    .badge.warning::before,
    .badge.changed::before {
      background: var(--warn);
    }

    .badge.error,
    .badge.disabled {
      background: var(--danger-soft);
      color: oklch(38% 0.14 28);
    }

    .badge.error::before,
    .badge.disabled::before {
      background: var(--danger);
    }

    .split {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .mini-stat {
      background: var(--panel-soft);
      border-radius: 6px;
      padding: 10px;
    }

    .mini-stat span {
      color: var(--muted);
      display: block;
      font-size: 0.75rem;
      margin-bottom: 6px;
    }

    .mini-stat strong {
      display: block;
      font-size: 1.25rem;
      letter-spacing: -0.012em;
    }

    .meter {
      background: var(--panel-soft);
      border-radius: 999px;
      display: flex;
      height: 10px;
      overflow: hidden;
    }

    .meter span {
      display: block;
      min-width: 2px;
    }

    .meter-html { background: var(--accent); }
    .meter-file { background: oklch(64% 0.12 215); }

    .panel {
      margin-top: 14px;
      overflow: hidden;
    }

    .results-panel {
      scroll-margin-top: 20px;
    }

    .results-panel[hidden],
    .result-view[hidden] {
      display: none;
    }

    .result-list {
      display: grid;
      gap: 10px;
      padding: 16px 18px 18px;
    }

    .result-item {
      align-items: start;
      background: var(--panel-soft);
      border-radius: 6px;
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(110px, 160px) 1fr;
      padding: 12px;
    }

    .result-item strong {
      display: block;
      font-size: 0.82rem;
      line-height: 1.35;
    }

    .result-item p {
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .result-item a {
      overflow-wrap: anywhere;
    }

    .inline-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 0 18px 18px;
    }

    .small-button {
      background: var(--panel-soft);
      border: 0;
      border-radius: 999px;
      color: var(--ink);
      cursor: pointer;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      min-height: 32px;
      padding: 0 12px;
      transition: transform 160ms ease, background 160ms ease;
    }

    .small-button:hover {
      background: var(--accent-soft);
    }

    .small-button:active {
      transform: scale(0.97);
    }

    .panel-head {
      align-items: center;
      border-bottom: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      padding: 16px 18px;
    }

    .panel-head p {
      color: var(--muted);
      font-size: 0.875rem;
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      border-collapse: collapse;
      min-width: 820px;
      width: 100%;
    }

    th,
    td {
      border-bottom: 1px solid var(--line);
      padding: 13px 18px;
      text-align: left;
      vertical-align: middle;
    }

    th {
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    td {
      font-size: 0.875rem;
      line-height: 1.45;
    }

    td.num,
    th.num {
      text-align: right;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    .resource {
      display: grid;
      gap: 2px;
      max-width: 560px;
    }

    .resource a {
      overflow-wrap: anywhere;
    }

    .resource span {
      color: var(--muted);
      font-size: 0.78rem;
      overflow-wrap: anywhere;
    }

    .kind {
      background: var(--panel-soft);
      border-radius: 999px;
      color: var(--muted);
      display: inline-flex;
      font-size: 0.72rem;
      font-weight: 700;
      min-height: 24px;
      padding: 4px 8px;
      text-transform: uppercase;
    }

    .empty {
      color: var(--muted);
      padding: 18px;
    }

    @media (max-width: 940px) {
      .metric-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .sites {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .page {
        padding: 22px 14px 34px;
      }

      .topbar {
        align-items: start;
        display: grid;
      }

      .timestamp {
        text-align: left;
      }

      .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .metric {
        min-height: 96px;
      }

      .metric strong {
        font-size: 1.65rem;
      }

      .site-header {
        display: grid;
      }

      .table-wrap {
        overflow: visible;
      }

      table,
      thead,
      tbody,
      tr,
      th,
      td {
        display: block;
        min-width: 0;
      }

      thead {
        display: none;
      }

      tr {
        border-bottom: 1px solid var(--line);
        display: grid;
        gap: 10px 14px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        padding: 14px 16px;
      }

      tr:last-child {
        border-bottom: 0;
      }

      td,
      td.num {
        border-bottom: 0;
        padding: 0;
        text-align: left;
      }

      td::before {
        color: var(--muted);
        content: attr(data-label);
        display: block;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      td[data-wide="true"] {
        grid-column: 1 / -1;
      }

      .result-item {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="topbar">
      <div>
        <h1>Sentinel dashboard</h1>
      </div>
      <p class="timestamp">Generata <time datetime="${escapeHtml(model.createdAt)}">${escapeHtml(generatedAt)}</time><br>Fonte: stato locale e ultimi report</p>
    </header>

    <section class="metric-grid" aria-label="Sintesi">
      ${renderMetric("Monitor", model.totals.enabledSites, "monitor")}
      ${renderMetric("URL", model.totals.urls, "urls")}
      ${renderMetric("File", model.totals.fileUrls, "files")}
      ${renderMetric("Cambiamenti", model.totals.changes, "changes")}
      ${renderMetric("Problemi", model.totals.issues, "issues")}
      ${renderMetric("Avvisi noti", model.totals.knownIssues, "known")}
    </section>

    ${renderResultsPanel(model)}

    <section class="sites" aria-label="Monitor configurati">
      ${model.sites.map(renderSiteCard).join("\n")}
    </section>

    <section class="panel" aria-labelledby="monitor-title">
      <div class="panel-head">
        <h2 id="monitor-title">Monitor</h2>
        <p>${model.sites.length} profili configurati</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sito</th>
              <th>Ultima scansione</th>
              <th class="num">URL</th>
              <th class="num">HTML</th>
              <th class="num">File</th>
              <th class="num">Snapshot</th>
              <th>Ultimo report</th>
            </tr>
          </thead>
          <tbody>
            ${model.sites.map(renderSiteRow).join("\n")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel" aria-labelledby="resources-title">
      <div class="panel-head">
        <h2 id="resources-title">URL aggiornati di recente</h2>
        <p>Ultimi ${Math.min(RECENT_RESOURCE_LIMIT, model.recentResources.length)} elementi visti</p>
      </div>
      ${renderRecentResources(model.recentResources)}
    </section>
  </main>
  <script>
    (() => {
      const panel = document.querySelector("[data-results-panel]");
      const title = document.querySelector("[data-results-title]");
      const subtitle = document.querySelector("[data-results-subtitle]");
      const buttons = [...document.querySelectorAll("[data-dashboard-button]")];
      const views = [...document.querySelectorAll("[data-result-view]")];

      const labels = {
        monitor: ["Monitor", "Profili configurati e ultimi report disponibili"],
        urls: ["URL monitorati", "Tutte le risorse presenti nello stato locale"],
        files: ["File pubblici", "File e asset pubblici monitorati"],
        changes: ["Cambiamenti", "Cambiamenti rilevati negli ultimi report"],
        issues: ["Problemi", "Problemi attivi rilevati negli ultimi report"],
        known: ["Avvisi noti", "Avvisi configurati come non azionabili"]
      };

      function showView(viewName, shouldScroll = true) {
        panel.hidden = false;
        views.forEach((view) => {
          view.hidden = view.dataset.resultView !== viewName;
        });
        buttons.forEach((button) => {
          button.setAttribute("aria-pressed", String(button.dataset.dashboardButton === viewName));
        });
        const [nextTitle, nextSubtitle] = labels[viewName] ?? labels.urls;
        title.textContent = nextTitle;
        subtitle.textContent = nextSubtitle;
        if (shouldScroll) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      buttons.forEach((button) => {
        button.addEventListener("click", () => showView(button.dataset.dashboardButton));
      });
    })();
  </script>
</body>
</html>
`;
}

export function parseScanReportSummary(siteId: string, filePath: string, linkHref: string, content: string): DashboardReportSummary {
  const siteName = readHeading(content) ?? siteId;

  return {
    siteId,
    siteName,
    filePath,
    linkHref,
    scanLabel: readReportValue(content, "Scansione"),
    mode: readReportValue(content, "Modalità"),
    baseline: readBooleanValue(content, "Baseline iniziale"),
    scannedCount: readNumberValue(content, "URL scansionati"),
    skippedCount: readNumberValue(content, "URL saltati"),
    changesCount: readNumberValue(content, "Cambiamenti"),
    issuesCount: readNumberValue(content, "Problemi"),
    knownIssuesCount: readNumberValue(content, "Avvisi noti"),
    emailRequired: readBooleanValue(content, "Email richiesta"),
    emailSent: readBooleanValue(content, "Email inviata"),
    fatalCount: countFatalIssues(content),
    issues: readIssues(content, siteName),
    knownIssues: readKnownIssues(content, siteName),
    changes: readChanges(content, siteName)
  };
}

async function readLatestReportSummaries(config: SentinelConfig, outputPath: string): Promise<DashboardReportSummary[]> {
  const reportsDir = resolveFromCwd(config.storage.reportsDir);
  let entries: string[];

  try {
    entries = await readdir(reportsDir);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }

  const summaries = await Promise.all(
    config.sites.map(async (site) => {
      const latest = entries
        .filter((entry) => entry.startsWith(`${site.id}-`) && entry.endsWith(".md"))
        .sort()
        .at(-1);

      if (!latest) return undefined;

      const filePath = path.join(reportsDir, latest);
      const linkHref = toHtmlLink(path.relative(path.dirname(outputPath), filePath));
      const content = await readFile(filePath, "utf8");
      return parseScanReportSummary(site.id, filePath, linkHref, content);
    })
  );

  return summaries.filter((summary): summary is DashboardReportSummary => Boolean(summary));
}

function buildDashboardSite(site: SiteConfig, siteState: SiteState | undefined, latestReport?: DashboardReportSummary): DashboardSite {
  const urls = Object.values(siteState?.urls ?? {});
  const htmlUrls = urls.filter((item) => item.kind === "html").length;
  const fileUrls = urls.filter((item) => item.kind === "file").length;

  return {
    id: site.id,
    name: site.name,
    enabled: site.enabled,
    lastScanAt: siteState?.lastScanAt,
    totalUrls: urls.length,
    htmlUrls,
    fileUrls,
    okUrls: urls.filter((item) => item.lastStatus >= 200 && item.lastStatus < 400).length,
    warningUrls: urls.filter((item) => item.lastStatus >= 400 && item.lastStatus < 500).length,
    errorUrls: urls.filter((item) => item.lastStatus >= 500).length,
    snapshotCount: urls.reduce((total, item) => total + item.snapshotIds.length, 0),
    latestReport
  };
}

function collectRecentResources(siteName: string, siteState?: SiteState): RecentResource[] {
  return Object.values(siteState?.urls ?? {}).map((item) => ({
    siteName,
    url: item.url,
    kind: item.kind,
    status: item.lastStatus,
    lastSeenAt: item.lastSeenAt,
    title: item.title
  }));
}

function renderMetric(label: string, value: number, viewName: string): string {
  return `<button class="metric" type="button" data-dashboard-button="${escapeHtml(viewName)}" aria-controls="dashboard-results" aria-pressed="false"><span>${escapeHtml(label)}</span><strong>${formatNumber(value)}</strong></button>`;
}

function renderResultsPanel(model: DashboardModel): string {
  return `<section class="panel results-panel" id="dashboard-results" data-results-panel hidden aria-live="polite">
  <div class="panel-head">
    <h2 data-results-title>Risultati</h2>
    <p data-results-subtitle>Seleziona un riquadro della sintesi</p>
  </div>
  <div class="result-view" data-result-view="monitor" hidden>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Sito</th>
            <th>Ultima scansione</th>
            <th class="num">URL</th>
            <th class="num">HTML</th>
            <th class="num">File</th>
            <th class="num">Snapshot</th>
            <th>Ultimo report</th>
          </tr>
        </thead>
        <tbody>
          ${model.sites.map(renderSiteRow).join("\n")}
        </tbody>
      </table>
    </div>
  </div>
  <div class="result-view" data-result-view="urls" hidden>
    ${renderResourceTable(model.resources)}
  </div>
  <div class="result-view" data-result-view="files" hidden>
    ${renderResourceTable(model.resources.filter((resource) => resource.kind === "file"))}
  </div>
  <div class="result-view" data-result-view="changes" hidden>
    ${renderChanges(model.changes)}
  </div>
  <div class="result-view" data-result-view="issues" hidden>
    ${renderIssues(model.issues)}
  </div>
  <div class="result-view" data-result-view="known" hidden>
    ${renderIssues(model.knownIssues)}
  </div>
</section>`;
}

function renderSiteCard(site: DashboardSite): string {
  const status = siteStatus(site);
  const htmlPercent = percent(site.htmlUrls, site.totalUrls);
  const filePercent = percent(site.fileUrls, site.totalUrls);
  const report = site.latestReport;
  const reportLine = report
    ? `${formatNumber(report.changesCount ?? 0)} cambiamenti, ${formatNumber(report.issuesCount ?? 0)} problemi, ${formatNumber(report.knownIssuesCount ?? 0)} avvisi noti`
    : "Nessun report disponibile";

  return `<article class="site-card">
  <div class="site-header">
    <div class="site-title">
      <h2>${escapeHtml(site.name)}</h2>
      <p>${site.lastScanAt ? `Ultima scansione ${escapeHtml(formatItalianDateTime(site.lastScanAt))}` : "Mai scansionato"}</p>
    </div>
    <span class="badge ${status.className}">${escapeHtml(status.label)}</span>
  </div>
  <div class="split">
    <div class="mini-stat"><span>URL</span><strong>${formatNumber(site.totalUrls)}</strong></div>
    <div class="mini-stat"><span>HTML</span><strong>${formatNumber(site.htmlUrls)}</strong></div>
    <div class="mini-stat"><span>File</span><strong>${formatNumber(site.fileUrls)}</strong></div>
  </div>
  <div class="meter" aria-label="${escapeHtml(site.name)}: ${site.htmlUrls} HTML e ${site.fileUrls} file">
    <span class="meter-html" style="width:${htmlPercent}%"></span>
    <span class="meter-file" style="width:${filePercent}%"></span>
  </div>
  <p class="site-meta">${escapeHtml(reportLine)}</p>
</article>`;
}

function renderSiteRow(site: DashboardSite): string {
  const report = site.latestReport;
  const reportLink = report
    ? `<a href="${escapeHtml(report.linkHref)}">${escapeHtml(path.basename(report.filePath))}</a>`
    : "Nessun report";

  return `<tr>
  <td data-label="Sito">${escapeHtml(site.name)} ${site.enabled ? "" : '<span class="badge disabled">Disabilitato</span>'}</td>
  <td data-label="Ultima scansione">${site.lastScanAt ? `<time datetime="${escapeHtml(site.lastScanAt)}">${escapeHtml(formatItalianDateTime(site.lastScanAt))}</time>` : "Mai"}</td>
  <td class="num" data-label="URL">${formatNumber(site.totalUrls)}</td>
  <td class="num" data-label="HTML">${formatNumber(site.htmlUrls)}</td>
  <td class="num" data-label="File">${formatNumber(site.fileUrls)}</td>
  <td class="num" data-label="Snapshot">${formatNumber(site.snapshotCount)}</td>
  <td data-label="Ultimo report" data-wide="true">${reportLink}</td>
</tr>`;
}

function renderRecentResources(resources: RecentResource[]): string {
  if (resources.length === 0) return '<p class="empty">Nessun URL nello stato locale.</p>';

  return renderResourceTable(resources);
}

function renderResourceTable(resources: RecentResource[]): string {
  if (resources.length === 0) return '<p class="empty">Nessun URL nello stato locale.</p>';

  return `<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Risorsa</th>
        <th>Sito</th>
        <th>Tipo</th>
        <th class="num">HTTP</th>
        <th>Vista</th>
      </tr>
    </thead>
    <tbody>
      ${resources.map(renderRecentResourceRow).join("\n")}
    </tbody>
  </table>
</div>`;
}

function renderChanges(changes: DashboardChange[]): string {
  if (changes.length === 0) return '<p class="empty">Nessun cambiamento negli ultimi report disponibili.</p>';

  return `<div class="result-list">
    ${changes.map(renderChangeItem).join("\n")}
  </div>`;
}

function renderChangeItem(change: DashboardChange): string {
  const title = change.title ? `<p>${escapeHtml(change.title)}</p>` : "";

  return `<article class="result-item">
  <strong>${escapeHtml(change.siteName)} · ${escapeHtml(change.type)}</strong>
  <div><a href="${escapeHtml(change.url)}" target="_blank" rel="noreferrer">${escapeHtml(change.url)}</a>${title}</div>
</article>`;
}

function renderIssues(issues: DashboardIssue[]): string {
  if (issues.length === 0) return '<p class="empty">Nessun problema negli ultimi report disponibili.</p>';

  return `<div class="result-list">
    ${issues.map(renderIssueItem).join("\n")}
  </div>`;
}

function renderIssueItem(issue: DashboardIssue): string {
  if (issue.severity === "summary") {
    return `<article class="result-item">
  <strong>${escapeHtml(issue.siteName)} · Riepilogo</strong>
  <p>${escapeHtml(issue.message)}${issue.count ? ` (${formatNumber(issue.count)})` : ""}</p>
</article>`;
  }

  const severity = issue.severity === "fatal" ? "FATALE" : issue.severity === "known" ? "Noto" : "Avviso";
  const url = issue.url ? `<a href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">${escapeHtml(issue.url)}</a>` : "<span>Risorsa tecnica</span>";
  const reason = issue.reason ? `<p>${escapeHtml(issue.reason)}</p>` : "";

  return `<article class="result-item">
  <strong>${escapeHtml(issue.siteName)} · ${severity}</strong>
  <div>${url}<p>${escapeHtml(issue.message)}</p>${reason}</div>
</article>`;
}

function renderRecentResourceRow(resource: RecentResource): string {
  const title = resource.title ? `<span>${escapeHtml(resource.title)}</span>` : "";

  return `<tr>
  <td data-label="Risorsa" data-wide="true"><div class="resource"><a href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer">${escapeHtml(resource.url)}</a>${title}</div></td>
  <td data-label="Sito">${escapeHtml(resource.siteName)}</td>
  <td data-label="Tipo"><span class="kind">${escapeHtml(resource.kind)}</span></td>
  <td class="num" data-label="HTTP">${resource.status}</td>
  <td data-label="Vista"><time datetime="${escapeHtml(resource.lastSeenAt)}">${escapeHtml(formatItalianDateTime(resource.lastSeenAt))}</time></td>
</tr>`;
}

function siteStatus(site: DashboardSite): { label: string; className: string } {
  const report = site.latestReport;

  if (!site.enabled) return { label: "Disabilitato", className: "disabled" };
  if (!report) return { label: "Senza report", className: "warning" };
  if (report.fatalCount > 0) return { label: "Errore", className: "error" };
  if ((report.changesCount ?? 0) > 0) return { label: "Cambiamenti", className: "changed" };
  if ((report.issuesCount ?? 0) > 0) return { label: "Avvisi", className: "warning" };
  return { label: "Stabile", className: "stable" };
}

function resolveDashboardPath(config: SentinelConfig, outputPath?: string): string {
  return resolveFromCwd(outputPath ?? path.join(config.storage.reportsDir, DEFAULT_DASHBOARD_FILE));
}

function readHeading(content: string): string | undefined {
  const match = content.match(/^# Report Sentinel - (.+)$/m);
  return match?.[1];
}

function readReportValue(content: string, label: string): string | undefined {
  const match = content.match(new RegExp(`^- ${escapeRegExp(label)}: (.+)$`, "m"));
  return match?.[1];
}

function readNumberValue(content: string, label: string): number | undefined {
  const raw = readReportValue(content, label);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw.replace(/\D/g, ""), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function readBooleanValue(content: string, label: string): boolean | undefined {
  const raw = readReportValue(content, label);
  if (!raw) return undefined;
  return raw.toLowerCase() === "sì";
}

function readIssues(content: string, siteName: string): DashboardIssue[] {
  return readMarkdownListSection(content, "Problemi").flatMap((line): DashboardIssue[] => {
    if (line === "Nessun problema rilevato.") return [];

    const summaryMatch = line.match(/^Altri avvisi(?: (.+))?: (\d+)$/);
    if (summaryMatch) {
      const reason = summaryMatch[1] ? `Altri avvisi ${summaryMatch[1]}` : "Altri avvisi";
      return [{
        siteName,
        severity: "summary" as const,
        message: reason,
        count: Number.parseInt(summaryMatch[2], 10)
      }];
    }

    const issueMatch = line.match(/^(FATALE|Avviso): (.+?) - (.+)$/);
    if (!issueMatch) {
      return [{
        siteName,
        severity: "summary" as const,
        message: line
      }];
    }

    return [{
      siteName,
      severity: issueMatch[1] === "FATALE" ? "fatal" as const : "warning" as const,
      url: issueMatch[2],
      message: issueMatch[3]
    }];
  });
}

function readKnownIssues(content: string, siteName: string): DashboardIssue[] {
  return readMarkdownListSection(content, "Avvisi noti").flatMap((line): DashboardIssue[] => {
    if (line === "Nessun avviso noto rilevato.") return [];

    const issueMatch = line.match(/^Noto: (.+?) - (.+?)(?: - (.+))?$/);
    if (!issueMatch) {
      return [{
        siteName,
        severity: "summary",
        message: line
      }];
    }

    return [{
      siteName,
      severity: "known",
      url: issueMatch[1],
      message: issueMatch[2],
      reason: issueMatch[3]
    }];
  });
}

function readChanges(content: string, siteName: string): DashboardChange[] {
  return readMarkdownListSection(content, "Cambiamenti").flatMap((line) => {
    if (line === "Nessun cambiamento rilevato.") return [];

    const changeMatch = line.match(/^(Aggiunto|Modificato|Rimosso): (.+?)(?: - (.+))?$/);
    if (!changeMatch) return [];

    return [{
      siteName,
      type: changeMatch[1],
      url: changeMatch[2],
      title: changeMatch[3]
    }];
  });
}

function readMarkdownListSection(content: string, heading: string): string[] {
  const headingPattern = new RegExp(`^## ${escapeRegExp(heading)}$`, "m");
  const headingMatch = headingPattern.exec(content);
  if (!headingMatch) return [];

  const afterHeading = content.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingIndex = afterHeading.search(/^## /m);
  const section = nextHeadingIndex >= 0 ? afterHeading.slice(0, nextHeadingIndex) : afterHeading;

  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

function countFatalIssues(content: string): number {
  return content.split("\n").filter((line) => line.startsWith("- FATALE:")).length;
}

function sum(sites: DashboardSite[], key: "totalUrls" | "htmlUrls" | "fileUrls"): number {
  return sites.reduce((total, site) => total + site[key], 0);
}

function percent(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("it-IT").format(value);
}

function toHtmlLink(targetPath: string): string {
  return targetPath.split(path.sep).map(encodeURIComponent).join("/");
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
