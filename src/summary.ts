import type { ScanResult } from "./types.js";

const MAX_NON_FATAL_ISSUES = 10;

export function formatScanSummary(result: ScanResult): string[] {
  const fatalIssues = result.issues.filter((issue) => issue.fatal);
  const nonFatalIssues = result.issues.filter((issue) => !issue.fatal);
  const visibleNonFatalIssues = nonFatalIssues.slice(0, Math.max(0, MAX_NON_FATAL_ISSUES - fatalIssues.length));
  const visibleIssues = [...fatalIssues, ...visibleNonFatalIssues];
  const omittedIssues = result.issues.length - visibleIssues.length;

  const lines = [
    `${result.siteName}: ${result.scannedCount} URL scansionati, ${result.changes.length} cambiamenti, ${result.issues.length} problemi (${fatalIssues.length} fatali).`
  ];

  if (result.baseline) lines.push("Baseline iniziale: email non inviata.");
  if (result.reportPath) lines.push(`Report: ${result.reportPath}`);

  for (const issue of visibleIssues) {
    lines.push(`- ${issue.fatal ? "FATALE" : "Avviso"} ${issue.url}: ${issue.message}`);
  }

  if (omittedIssues > 0) lines.push(`- Altri problemi: ${omittedIssues}`);
  return lines;
}
