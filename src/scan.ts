import type {
  FetchedResource,
  QueuedUrl,
  ScanChange,
  ScanIssue,
  ScanResult,
  SentinelConfig,
  SiteConfig
} from "./types.js";
import { sendScanEmail } from "./email.js";
import { fetchResource } from "./fetch-resource.js";
import { discoverFromSitemaps } from "./sitemap.js";
import {
  getOrCreateSiteState,
  isInitialBaseline,
  loadState,
  pruneSnapshots,
  saveState,
  toUrlState,
  writeSnapshot
} from "./storage.js";
import { writeScanReport } from "./report.js";
import { isIncludedFile, looksLikeHtmlPage } from "./url.js";
import { RobotsGuard } from "./robots.js";

export interface ScanOptions {
  dryRun: boolean;
}

export async function scanSite(config: SentinelConfig, site: SiteConfig, options: ScanOptions): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();
  const state = await loadState(config);
  const siteState = getOrCreateSiteState(state, site);
  const baseline = isInitialBaseline(siteState);
  const issues: ScanIssue[] = [];
  const changes: ScanChange[] = [];
  const resources: FetchedResource[] = [];
  const seenUrls = new Set<string>();
  const guard = new RobotsGuard(site);

  const queue = await buildInitialQueue(site, guard, issues);
  let scannedCount = 0;
  let skippedCount = 0;

  while (queue.length > 0 && scannedCount < site.crawl.maxUrls && !hasFatalIssues(issues)) {
    const item = queue.shift();
    if (!item || seenUrls.has(item.url)) continue;

    if (!(await canFetch(guard, item.url, issues))) {
      skippedCount += 1;
      seenUrls.add(item.url);
      continue;
    }

    seenUrls.add(item.url);
    const resource = await fetchUrl(item, site, issues);
    if (!resource) continue;
    const alreadySeenFinalUrl = resource.url !== item.url && seenUrls.has(resource.url);
    seenUrls.add(resource.url);
    if (alreadySeenFinalUrl) continue;
    scannedCount += 1;

    if (resource.status >= 400) {
      issues.push({ url: resource.url, message: `HTTP ${resource.status}`, fatal: false });
      continue;
    }

    const previous = siteState.urls[resource.url];
    if (!baseline) {
      if (!previous) {
        changes.push({ type: "added", url: resource.url, kind: resource.kind, currentHash: resource.hash, title: resource.title });
      } else if (previous.hash !== resource.hash) {
        changes.push({
          type: "changed",
          url: resource.url,
          kind: resource.kind,
          previousHash: previous.hash,
          currentHash: resource.hash,
          title: resource.title
        });
      }
    }

    resources.push(resource);
    enqueueDiscovered(queue, seenUrls, site, resource);
  }

  if (!baseline && !hasFatalIssues(issues)) {
    for (const previousUrl of Object.keys(siteState.urls)) {
      if (seenUrls.has(previousUrl)) continue;
      changes.push({
        type: "removed",
        url: previousUrl,
        kind: siteState.urls[previousUrl].kind,
        previousHash: siteState.urls[previousUrl].hash,
        title: siteState.urls[previousUrl].title
      });
    }
  }

  if (!options.dryRun && !hasFatalIssues(issues)) {
    await persistResources(config, site, siteState, resources);
    for (const change of changes) {
      if (change.type === "removed") delete siteState.urls[change.url];
    }
    siteState.lastScanAt = scannedAt;
    await saveState(config, state);
  }

  const emailRequired = !options.dryRun && (hasFatalIssues(issues) || (!baseline && changes.length > 0));
  const result: ScanResult = {
    siteId: site.id,
    siteName: site.name,
    scannedAt,
    baseline,
    dryRun: options.dryRun,
    scannedCount,
    skippedCount,
    changes,
    issues,
    emailSent: false,
    emailRequired
  };

  if (!options.dryRun) {
    result.reportPath = await writeScanReport(config, site, result);
  }

  if (emailRequired && config.email.enabled) {
    try {
      await sendScanEmail(config.email, site, result);
      result.emailSent = true;
    } catch (error) {
      result.issues.push({
        url: "email",
        message: error instanceof Error ? error.message : String(error),
        fatal: true
      });
    }
  }

  if (!options.dryRun && result.reportPath && result.issues.some((issue) => issue.url === "email")) {
    result.reportPath = await writeScanReport(config, site, result);
  }

  return result;
}

async function persistResources(
  config: SentinelConfig,
  site: SiteConfig,
  siteState: ReturnType<typeof getOrCreateSiteState>,
  resources: FetchedResource[]
): Promise<void> {
  for (const resource of resources) {
    const previous = siteState.urls[resource.url];
    const snapshotIds = previous?.snapshotIds ? [...previous.snapshotIds] : [];
    if (!previous || previous.hash !== resource.hash) {
      snapshotIds.push(await writeSnapshot(config, site, resource));
    }
    const prunedSnapshotIds = await pruneSnapshots(config, snapshotIds);
    siteState.urls[resource.url] = toUrlState(resource, previous?.firstSeenAt ?? resource.fetchedAt, prunedSnapshotIds);
  }
}

async function buildInitialQueue(site: SiteConfig, guard: RobotsGuard, issues: ScanIssue[]): Promise<QueuedUrl[]> {
  const queue = new Map<string, QueuedUrl>();
  const sitemapUrls = new Set(site.sitemapUrls);

  for (const root of site.roots) {
    queue.set(root, { url: root, depth: 0 });
    try {
      for (const sitemapUrl of await guard.sitemapsForRoot(root)) {
        sitemapUrls.add(sitemapUrl);
      }
    } catch (error) {
      issues.push({ url: root, message: errorMessage(error), fatal: true });
    }
  }

  try {
    for (const item of await discoverFromSitemaps(site, [...sitemapUrls])) {
      queue.set(item.url, item);
      if (queue.size >= site.crawl.maxUrls) break;
    }
  } catch (error) {
    issues.push({ url: "sitemap", message: errorMessage(error), fatal: true });
  }

  return [...queue.values()];
}

async function canFetch(guard: RobotsGuard, url: string, issues: ScanIssue[]): Promise<boolean> {
  try {
    return await guard.canFetch(url);
  } catch (error) {
    issues.push({ url, message: errorMessage(error), fatal: true });
    return false;
  }
}

async function fetchUrl(item: QueuedUrl, site: SiteConfig, issues: ScanIssue[]): Promise<FetchedResource | undefined> {
  try {
    return await fetchResource(item.url, site, item.depth, item.sourceUrl);
  } catch (error) {
    issues.push({ url: item.url, message: errorMessage(error), fatal: false });
    return undefined;
  }
}

function enqueueDiscovered(queue: QueuedUrl[], seenUrls: Set<string>, site: SiteConfig, resource: FetchedResource): void {
  if (resource.depth >= site.crawl.maxDepth) return;

  for (const url of resource.discoveredUrls) {
    if (seenUrls.has(url)) continue;
    if (!looksLikeHtmlPage(url, site) && !isIncludedFile(url, site)) continue;
    if (queue.some((item) => item.url === url)) continue;
    queue.push({ url, depth: resource.depth + 1, sourceUrl: resource.url });
    if (queue.length + seenUrls.size >= site.crawl.maxUrls) return;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasFatalIssues(issues: ScanIssue[]): boolean {
  return issues.some((issue) => issue.fatal);
}
