import type {
  FetchedResource,
  QueuedUrl,
  ScanChange,
  ScanIssue,
  ScanResult,
  SentinelConfig,
  SiteConfig,
  SiteState
} from "./types.js";
import { sendScanEmail } from "./email.js";
import { fetchResource } from "./fetch-resource.js";
import { OutboundBudgetError, OutboundClient } from "./outbound.js";
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

interface CrawlCounters {
  scannedCount: number;
  skippedCount: number;
}

export async function scanSite(
  config: SentinelConfig,
  site: SiteConfig,
  options: ScanOptions,
  client = new OutboundClient(site)
): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();
  const state = await loadState(config);
  const siteState = getOrCreateSiteState(state, site);
  const baseline = isInitialBaseline(siteState);
  const issues: ScanIssue[] = [];
  const changes: ScanChange[] = [];
  const resources: FetchedResource[] = [];
  const seenUrls = new Set<string>();
  const guard = new RobotsGuard(site, client);

  const counters: CrawlCounters = { scannedCount: 0, skippedCount: 0 };
  try {
    const queue = await buildInitialQueue(site, guard, issues, client);
    await crawlQueue(site, guard, client, queue, seenUrls, issues, resources, changes, siteState, baseline, counters);
  } finally {
    // Le connessioni riusate durante il crawling vanno chiuse qui, o il
    // processo resta appeso anche quando lo scan è finito.
    await client.close();
  }

  if (!baseline && !hasFatalIssues(issues)) {
    changes.push(...collectRemovals(siteState, seenUrls, issues, resources));
  }

  // Un monitor con baseline che non raccoglie nulla è un blackout, non un sito
  // vuoto: senza avviso resterebbe un run verde con zero risorse.
  const blackout = !baseline && isScanBlackout(siteState, resources);
  if (blackout) {
    issues.push({
      url: site.roots[0] ?? site.id,
      message: "Nessuna risorsa raccolta: sito irraggiungibile o scansione bloccata.",
      fatal: false
    });
  }

  if (!options.dryRun && !hasFatalIssues(issues)) {
    await persistResources(config, site, siteState, resources);
    for (const change of changes) {
      if (change.type === "removed") delete siteState.urls[change.url];
    }
    siteState.lastScanAt = scannedAt;
    await saveState(config, state);
  }

  const emailRequired =
    !options.dryRun && (hasActiveIssues(issues) || blackout || (!baseline && changes.length > 0));
  const result: ScanResult = {
    siteId: site.id,
    siteName: site.name,
    scannedAt,
    baseline,
    dryRun: options.dryRun,
    scannedCount: counters.scannedCount,
    skippedCount: counters.skippedCount,
    changes,
    issues,
    emailSent: false,
    emailRequired
  };

  if (emailRequired) {
    if (!config.email.enabled) {
      result.issues.push({
        url: "email",
        message: "Email richiesta ma invio disabilitato nella configurazione.",
        fatal: true
      });
    } else {
      try {
        await sendScanEmail(config.email, site, { ...result, emailSent: true });
        result.emailSent = true;
      } catch (error) {
        result.issues.push({
          url: "email",
          message: error instanceof Error ? error.message : String(error),
          fatal: true
        });
      }
    }
  }

  if (!options.dryRun) {
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
  await Promise.all(resources.map(async (resource) => {
    const previous = siteState.urls[resource.url];
    const snapshotIds = previous?.snapshotIds ? [...previous.snapshotIds] : [];
    if (!previous || previous.hash !== resource.hash) {
      snapshotIds.push(await writeSnapshot(config, site, resource));
    }
    const prunedSnapshotIds = await pruneSnapshots(config, snapshotIds);
    siteState.urls[resource.url] = toUrlState(resource, previous?.firstSeenAt ?? resource.fetchedAt, prunedSnapshotIds);
  }));
}

async function buildInitialQueue(
  site: SiteConfig,
  guard: RobotsGuard,
  issues: ScanIssue[],
  client: OutboundClient
): Promise<QueuedUrl[]> {
  const queue = new Map<string, QueuedUrl>();
  const sitemapUrls = new Set(site.sitemapUrls);

  for (const root of site.roots) {
    queue.set(root, { url: root, depth: 0 });
  }

  const rootSitemaps = await Promise.all(
    site.roots.map(async (root) => {
      try {
        return { root, sitemapUrls: await guard.sitemapsForRoot(root) };
      } catch (error) {
        issues.push({ url: root, message: errorMessage(error), fatal: true });
        return undefined;
      }
    })
  );

  for (const result of rootSitemaps) {
    if (!result) continue;
    for (const sitemapUrl of result.sitemapUrls) sitemapUrls.add(sitemapUrl);
  }

  for (const item of await discoverFromSitemaps(site, [...sitemapUrls], issues, client)) {
    queue.set(item.url, item);
    if (queue.size >= site.crawl.maxUrls) break;
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

async function fetchUrl(
  item: QueuedUrl,
  site: SiteConfig,
  issues: ScanIssue[],
  client: OutboundClient
): Promise<FetchedResource | undefined> {
  try {
    return await fetchResource(item.url, site, item.depth, client, item.sourceUrl);
  } catch (error) {
    issues.push({ url: item.url, message: errorMessage(error), fatal: error instanceof OutboundBudgetError });
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

function buildHttpIssue(site: SiteConfig, resource: FetchedResource): ScanIssue {
  const message = `HTTP ${resource.status}`;
  const ignoredRule = site.ignoredIssues.find((rule) => {
    if (rule.status !== undefined && rule.status !== resource.status) return false;
    if (rule.message && rule.message !== message) return false;
    if (rule.urlIncludes && !resource.url.includes(rule.urlIncludes)) return false;
    if (rule.urlPatternRegex && !rule.urlPatternRegex.test(resource.url)) return false;
    return true;
  });

  return {
    url: resource.url,
    message,
    fatal: false,
    ignored: Boolean(ignoredRule),
    ignoredReason: ignoredRule?.reason
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasFatalIssues(issues: ScanIssue[]): boolean {
  return issues.some((issue) => issue.fatal);
}

function hasActiveIssues(issues: ScanIssue[]): boolean {
  return issues.some((issue) => !issue.ignored);
}

/**
 * Vero quando un monitor che aveva già una baseline non raccoglie più nulla:
 * blocco lato sito, DNS o rete, mai un sito realmente svuotato.
 */
export function isScanBlackout(siteState: SiteState, resources: FetchedResource[]): boolean {
  return resources.length === 0 && Object.keys(siteState.urls).length > 0;
}

/**
 * Deduce le rimozioni confrontando lo stato precedente con quanto visto ora.
 * "Non l'ho visto" non significa "non c'è più": un blocco lato sito produce
 * pagine non raggiunte, non pagine rimosse. Senza queste due guardie un WAF che
 * risponde 4xx cancellerebbe la baseline e manderebbe un'email di rimozione
 * totale.
 */
export function collectRemovals(
  siteState: SiteState,
  seenUrls: Set<string>,
  issues: ScanIssue[],
  resources: FetchedResource[]
): ScanChange[] {
  if (hasActiveIssues(issues) || isScanBlackout(siteState, resources)) return [];

  const knownUrls = Object.keys(siteState.urls);
  const removals: ScanChange[] = [];

  for (const previousUrl of knownUrls) {
    if (seenUrls.has(previousUrl)) continue;
    removals.push({
      type: "removed",
      url: previousUrl,
      kind: siteState.urls[previousUrl].kind,
      previousHash: siteState.urls[previousUrl].hash,
      title: siteState.urls[previousUrl].title
    });
  }

  return removals;
}

async function crawlQueue(
  site: SiteConfig,
  guard: RobotsGuard,
  client: OutboundClient,
  queue: QueuedUrl[],
  seenUrls: Set<string>,
  issues: ScanIssue[],
  resources: FetchedResource[],
  changes: ScanChange[],
  siteState: ReturnType<typeof getOrCreateSiteState>,
  baseline: boolean,
  counters: CrawlCounters
): Promise<void> {
  if (queue.length === 0 || counters.scannedCount >= site.crawl.maxUrls || hasFatalIssues(issues)) return;

  const item = queue.shift();
  if (!item || seenUrls.has(item.url)) {
    await crawlQueue(site, guard, client, queue, seenUrls, issues, resources, changes, siteState, baseline, counters);
    return;
  }

  if (!(await canFetch(guard, item.url, issues))) {
    counters.skippedCount += 1;
    seenUrls.add(item.url);
    await crawlQueue(site, guard, client, queue, seenUrls, issues, resources, changes, siteState, baseline, counters);
    return;
  }

  seenUrls.add(item.url);
  const resource = await fetchUrl(item, site, issues, client);
  if (!resource) {
    await crawlQueue(site, guard, client, queue, seenUrls, issues, resources, changes, siteState, baseline, counters);
    return;
  }

  const alreadySeenFinalUrl = resource.url !== item.url && seenUrls.has(resource.url);
  seenUrls.add(resource.url);
  if (alreadySeenFinalUrl) {
    await crawlQueue(site, guard, client, queue, seenUrls, issues, resources, changes, siteState, baseline, counters);
    return;
  }

  counters.scannedCount += 1;

  if (resource.status >= 400) {
    issues.push(buildHttpIssue(site, resource));
    await crawlQueue(site, guard, client, queue, seenUrls, issues, resources, changes, siteState, baseline, counters);
    return;
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
  await crawlQueue(site, guard, client, queue, seenUrls, issues, resources, changes, siteState, baseline, counters);
}
