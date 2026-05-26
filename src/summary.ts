import type { ScanResult } from "./types.js";

const MAX_NON_FATAL_ISSUES = 10;

export function formatScanSummary(result: ScanResult): string[] {
  const activeIssues = result.issues.filter((issue) => !issue.ignored);
  const ignoredIssues = result.issues.filter((issue) => issue.ignored);
  const fatalIssues = activeIssues.filter((issue) => issue.fatal);
  const nonFatalIssues = activeIssues.filter((issue) => !issue.fatal);
  const visibleNonFatalIssues = nonFatalIssues.slice(0, Math.max(0, MAX_NON_FATAL_ISSUES - fatalIssues.length));
  const visibleIssues = [...fatalIssues, ...visibleNonFatalIssues];
  const omittedIssues = activeIssues.length - visibleIssues.length;

  const lines = [
    `${result.siteName}: ${result.scannedCount} URL scansionati, ${result.changes.length} cambiamenti, ${activeIssues.length} problemi attivi, ${ignoredIssues.length} avvisi noti (${fatalIssues.length} fatali).`
  ];

  if (result.baseline) lines.push("Baseline iniziale: email non inviata.");
  if (result.reportPath) lines.push(`Report: ${result.reportPath}`);

  for (const issue of visibleIssues) {
    lines.push(`- ${issue.fatal ? "FATALE" : "Avviso"} ${issue.url}: ${issue.message}`);
  }

  if (omittedIssues > 0) lines.push(`- Altri problemi: ${omittedIssues}`);
  if (ignoredIssues.length > 0) lines.push(`- Avvisi noti ignorati dal conteggio problemi: ${ignoredIssues.length}`);
  return lines;
}
