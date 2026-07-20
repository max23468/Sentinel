import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardChange, DashboardIssue, DashboardModel, DashboardSite, RecentResource } from "../src/dashboard";

type DashboardView = "monitor" | "urls" | "files" | "changes" | "issues" | "known";

const numberFormatter = new Intl.NumberFormat("it-IT");
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function DashboardClient(): React.ReactElement {
  const [model, setModel] = useState<DashboardModel | undefined>();
  const [selectedView, setSelectedView] = useState<DashboardView>("monitor");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error(`Dashboard non disponibile (${response.status}).`);
      const nextModel = (await response.json()) as DashboardModel;
      setModel(nextModel);
      setSelectedView(defaultView(nextModel));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    if (!model) return [];
    return [
      { label: "Monitor", value: model.totals.enabledSites, view: "monitor" as const },
      { label: "URL", value: model.totals.urls, view: "urls" as const },
      { label: "File", value: model.totals.fileUrls, view: "files" as const },
      { label: "Cambiamenti", value: model.totals.changes, view: "changes" as const },
      { label: "Problemi", value: model.totals.issues, view: "issues" as const },
      { label: "Avvisi noti", value: model.totals.knownIssues, view: "known" as const }
    ];
  }, [model]);

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Sentinel dashboard</h1>
          <p className="lead">Monitor operativi, problemi attivi e avvisi noti in una vista protetta.</p>
        </div>
        <div className="toolbar">
          <button className="refresh-button" type="button" onClick={loadDashboard} disabled={isLoading}>
            {isLoading ? "Aggiorno" : "Aggiorna"}
          </button>
          <p className="timestamp">{model ? `Dati aggiornati ${formatDate(model.createdAt)}` : "Caricamento dati"}</p>
        </div>
      </header>

      {error ? <p className="status error">{error}</p> : null}

      <section className="metric-grid" aria-label="Sintesi">
        {metrics.map((metric) => (
          <button
            aria-pressed={selectedView === metric.view}
            className="metric"
            key={metric.view}
            onClick={() => setSelectedView(metric.view)}
            type="button"
          >
            <span>{metric.label}</span>
            <strong>{formatNumber(metric.value)}</strong>
          </button>
        ))}
      </section>

      {!model && !error ? <p className="status">Caricamento dashboard…</p> : null}

      {model ? (
        <>
          <ResultPanel model={model} selectedView={selectedView} />

          <section className="sites" aria-label="Monitor configurati">
            {model.sites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </section>

          <section className="panel">
            <PanelHeader title="URL aggiornati di recente" detail={`${model.recentResources.length} elementi`} />
            <ResourceTable resources={model.recentResources} />
          </section>
        </>
      ) : null}
    </main>
  );
}

function ResultPanel({ model, selectedView }: { model: DashboardModel; selectedView: DashboardView }): React.ReactElement {
  const title = viewTitle(selectedView);
  const detail = viewDetail(model, selectedView);

  return (
    <section className="panel results-panel" aria-live="polite">
      <PanelHeader title={title} detail={detail} />
      {selectedView === "monitor" ? <MonitorTable sites={model.sites} /> : null}
      {selectedView === "urls" ? <ResourceTable resources={model.resources} /> : null}
      {selectedView === "files" ? <ResourceTable resources={model.resources.filter((resource) => resource.kind === "file")} /> : null}
      {selectedView === "changes" ? <ChangeList changes={model.changes} /> : null}
      {selectedView === "issues" ? <IssueList issues={model.issues} /> : null}
      {selectedView === "known" ? <IssueList issues={model.knownIssues} /> : null}
    </section>
  );
}

function SiteCard({ site }: { site: DashboardSite }): React.ReactElement {
  const status = siteStatus(site);
  const report = site.latestReport;
  const htmlPercent = percent(site.htmlUrls, site.totalUrls);
  const filePercent = percent(site.fileUrls, site.totalUrls);

  return (
    <article className="site-card">
      <div className="site-header">
        <div className="site-title">
          <h2>{site.name}</h2>
          <p>{site.lastScanAt ? `Ultima scansione ${formatDate(site.lastScanAt)}` : "Mai scansionato"}</p>
        </div>
        <span className={`badge ${status.className}`}>{status.label}</span>
      </div>
      <div className="split">
        <MiniStat label="URL" value={site.totalUrls} />
        <MiniStat label="HTML" value={site.htmlUrls} />
        <MiniStat label="File" value={site.fileUrls} />
      </div>
      <div className="meter" aria-label={`${site.name}: ${site.htmlUrls} HTML e ${site.fileUrls} file`}>
        <span className="meter-html" style={{ width: `${htmlPercent}%` }} />
        <span className="meter-file" style={{ width: `${filePercent}%` }} />
      </div>
      <p className="site-meta">
        {report
          ? `${formatNumber(report.changesCount ?? 0)} cambiamenti, ${formatNumber(report.issuesCount ?? 0)} problemi, ${formatNumber(report.knownIssuesCount ?? 0)} avvisi noti`
          : "Nessun report disponibile"}
      </p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function MonitorTable({ sites }: { sites: DashboardSite[] }): React.ReactElement {
  if (sites.length === 0) return <p className="empty">Nessun monitor configurato.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Sito</th>
            <th>Ultima scansione</th>
            <th className="num">URL</th>
            <th className="num">HTML</th>
            <th className="num">File</th>
            <th className="num">Snapshot</th>
            <th>Ultimo report</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.id}>
              <td data-label="Sito">{site.name}</td>
              <td data-label="Ultima scansione">{site.lastScanAt ? formatDate(site.lastScanAt) : "Mai"}</td>
              <td className="num" data-label="URL">{formatNumber(site.totalUrls)}</td>
              <td className="num" data-label="HTML">{formatNumber(site.htmlUrls)}</td>
              <td className="num" data-label="File">{formatNumber(site.fileUrls)}</td>
              <td className="num" data-label="Snapshot">{formatNumber(site.snapshotCount)}</td>
              <td data-label="Ultimo report" data-wide="true">
                {site.latestReport ? <a href={site.latestReport.linkHref}>{site.latestReport.filePath}</a> : "Nessun report"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResourceTable({ resources }: { resources: RecentResource[] }): React.ReactElement {
  if (resources.length === 0) return <p className="empty">Nessun URL disponibile.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Risorsa</th>
            <th>Sito</th>
            <th>Tipo</th>
            <th className="num">HTTP</th>
            <th>Vista</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={`${resource.siteName}-${resource.url}`}>
              <td data-label="Risorsa" data-wide="true">
                <div className="resource">
                  <a href={resource.url} rel="noreferrer" target="_blank">{resource.url}</a>
                  {resource.title ? <span>{resource.title}</span> : null}
                </div>
              </td>
              <td data-label="Sito">{resource.siteName}</td>
              <td data-label="Tipo"><span className="kind">{resource.kind}</span></td>
              <td className="num" data-label="HTTP">{resource.status}</td>
              <td data-label="Vista">{formatDate(resource.lastSeenAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeList({ changes }: { changes: DashboardChange[] }): React.ReactElement {
  if (changes.length === 0) return <p className="empty">Nessun cambiamento negli ultimi report disponibili.</p>;

  return (
    <div className="result-list">
      {changes.map((change) => (
        <article className="result-item" key={`${change.siteName}-${change.type}-${change.url}`}>
          <strong>{change.siteName} · {change.type}</strong>
          <div>
            <a href={change.url} rel="noreferrer" target="_blank">{change.url}</a>
            {change.title ? <p>{change.title}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function IssueList({ issues }: { issues: DashboardIssue[] }): React.ReactElement {
  if (issues.length === 0) return <p className="empty">Nessun elemento negli ultimi report disponibili.</p>;

  return (
    <div className="result-list">
      {issues.map((issue, index) => (
        <article className="result-item" key={`${issue.siteName}-${issue.url ?? issue.message}-${index}`}>
          <strong>{issue.siteName} · {issueLabel(issue)}</strong>
          <div>
            {issue.url ? <a href={issue.url} rel="noreferrer" target="_blank">{issue.url}</a> : <span>Risorsa tecnica</span>}
            <p>{issue.message}{issue.count ? ` (${formatNumber(issue.count)})` : ""}</p>
            {issue.reason ? <p>{issue.reason}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function PanelHeader({ title, detail }: { title: string; detail: string }): React.ReactElement {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

function defaultView(model: DashboardModel): DashboardView {
  if (model.totals.issues > 0) return "issues";
  if (model.totals.changes > 0) return "changes";
  if (model.totals.knownIssues > 0) return "known";
  return "monitor";
}

function viewTitle(view: DashboardView): string {
  return {
    monitor: "Monitor",
    urls: "URL monitorati",
    files: "File pubblici",
    changes: "Cambiamenti",
    issues: "Problemi",
    known: "Avvisi noti"
  }[view];
}

function viewDetail(model: DashboardModel, view: DashboardView): string {
  return {
    monitor: `${model.sites.length} profili configurati`,
    urls: `${model.resources.length} risorse`,
    files: `${model.resources.filter((resource) => resource.kind === "file").length} file`,
    changes: `${model.changes.length} cambiamenti`,
    issues: `${model.issues.length} problemi attivi`,
    known: `${model.knownIssues.length} avvisi classificati`
  }[view];
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

function issueLabel(issue: DashboardIssue): string {
  if (issue.severity === "fatal") return "FATALE";
  if (issue.severity === "known") return "Noto";
  if (issue.severity === "summary") return "Riepilogo";
  return "Avviso";
}

function percent(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}
