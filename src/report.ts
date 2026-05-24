import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScanChange, ScanIssue, ScanResult, SentinelConfig, SentinelState, SiteConfig } from "./types.js";
import { ensureDir, resolveFromCwd } from "./fs.js";
import { formatItalianDateTime, timestampForFile } from "./time.js";

const MAX_NON_FATAL_ISSUES = 10;

export async function writeScanReport(config: SentinelConfig, site: SiteConfig, result: ScanResult): Promise<string> {
  const reportId = `${site.id}-${timestampForFile(new Date(result.scannedAt))}.md`;
  const reportPath = resolveFromCwd(path.join(config.storage.reportsDir, reportId));
  await ensureDir(path.dirname(reportPath));
  await writeFile(reportPath, renderScanReport(result), "utf8");
  return reportPath;
}

export async function writeInventoryReport(config: SentinelConfig, state: SentinelState): Promise<string> {
  const createdAt = new Date().toISOString();
  const reportPath = resolveFromCwd(path.join(config.storage.reportsDir, `inventory-${timestampForFile(new Date(createdAt))}.md`));
  await ensureDir(path.dirname(reportPath));
  await writeFile(reportPath, renderInventoryReport(state, createdAt), "utf8");
  return reportPath;
}

export function renderScanReport(result: ScanResult): string {
  const lines = [
    `# Report Sentinel - ${result.siteName}`,
    "",
    `- Scansione: ${formatItalianDateTime(result.scannedAt)}`,
    `- Modalità: ${result.dryRun ? "dry-run" : "operativa"}`,
    `- Baseline iniziale: ${result.baseline ? "sì" : "no"}`,
    `- URL scansionati: ${result.scannedCount}`,
    `- URL saltati: ${result.skippedCount}`,
    `- Cambiamenti: ${result.changes.length}`,
    `- Problemi: ${result.issues.length}`,
    `- Email richiesta: ${result.emailRequired ? "sì" : "no"}`,
    `- Email inviata: ${result.emailSent ? "sì" : "no"}`,
    ""
  ];

  if (result.baseline) {
    lines.push("## Sintesi", "", "Baseline iniziale creata. Nessuna email inviata per policy.", "");
  } else if (result.changes.length === 0 && result.issues.length === 0) {
    lines.push("## Sintesi", "", "Nessun cambiamento o errore rilevato.", "");
  }

  lines.push("## Cambiamenti", "");
  lines.push(...renderChanges(result.changes));
  lines.push("", "## Problemi", "");
  lines.push(...renderIssues(result.issues));
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export function renderInventoryReport(state: SentinelState, createdAt: string): string {
  const lines = [
    "# Inventario Sentinel",
    "",
    `- Generato: ${formatItalianDateTime(createdAt)}`,
    ""
  ];

  for (const site of Object.values(state.sites)) {
    const urls = Object.values(site.urls);
    lines.push(`## ${site.name}`, "");
    lines.push(`- Ultima scansione: ${site.lastScanAt ? formatItalianDateTime(site.lastScanAt) : "mai"}`);
    lines.push(`- URL monitorati: ${urls.length}`);
    lines.push("");

    for (const item of urls.sort((left, right) => left.url.localeCompare(right.url))) {
      lines.push(`- ${item.kind.toUpperCase()} ${item.url}`);
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderChanges(changes: ScanChange[]): string[] {
  if (changes.length === 0) return ["Nessun cambiamento rilevato."];
  return changes.map((change) => {
    const label = change.type === "added" ? "Aggiunto" : change.type === "changed" ? "Modificato" : "Rimosso";
    const title = change.title ? ` - ${change.title}` : "";
    return `- ${label}: ${change.url}${title}`;
  });
}

function renderIssues(issues: ScanIssue[]): string[] {
  if (issues.length === 0) return ["Nessun problema rilevato."];

  const fatalIssues = issues.filter((issue) => issue.fatal);
  const nonFatalIssues = issues.filter((issue) => !issue.fatal);
  const lines = fatalIssues.map((issue) => renderIssue(issue));
  lines.push(...nonFatalIssues.slice(0, MAX_NON_FATAL_ISSUES).map((issue) => renderIssue(issue)));

  const omittedIssues = nonFatalIssues.slice(MAX_NON_FATAL_ISSUES);
  if (omittedIssues.length > 0) {
    const groupedMessages = new Set(omittedIssues.map((issue) => issue.message));
    const suffix = groupedMessages.size === 1 ? ` ${omittedIssues[0]?.message}` : "";
    lines.push(`- Altri avvisi${suffix}: ${omittedIssues.length}`);
  }

  return lines;
}

function renderIssue(issue: ScanIssue): string {
  return `- ${issue.fatal ? "FATALE" : "Avviso"}: ${issue.url} - ${issue.message}`;
}
