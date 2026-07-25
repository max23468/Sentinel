import { XMLParser } from "fast-xml-parser";
import type { QueuedUrl, ScanIssue, SiteConfig } from "./types.js";
import { isIncludedFile, isSameSite, looksLikeHtmlPage, normalizeUrl } from "./url.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

export async function discoverFromSitemaps(
  site: SiteConfig,
  sitemapUrls: string[],
  issues: ScanIssue[]
): Promise<QueuedUrl[]> {
  const discovered = new Map<string, QueuedUrl>();
  const seenSitemaps = new Set<string>();
  const queue = [...sitemapUrls];

  await processSitemapQueue(site, queue, seenSitemaps, discovered, issues);

  return [...discovered.values()];
}

async function processSitemapQueue(
  site: SiteConfig,
  queue: string[],
  seenSitemaps: Set<string>,
  discovered: Map<string, QueuedUrl>,
  issues: ScanIssue[]
): Promise<void> {
  if (discovered.size >= site.crawl.maxUrls) return;

  const sitemapUrl = queue.shift();
  if (!sitemapUrl) return;
  if (seenSitemaps.has(sitemapUrl)) {
    await processSitemapQueue(site, queue, seenSitemaps, discovered, issues);
    return;
  }

  seenSitemaps.add(sitemapUrl);
  // Una sitemap illeggibile non ferma la scansione: il crawling dai roots resta
  // la fonte principale, la sitemap aggiunge le pagine non linkate.
  const body = await readSitemap(site, sitemapUrl, issues);
  if (body === undefined) {
    await processSitemapQueue(site, queue, seenSitemaps, discovered, issues);
    return;
  }

  let parsed: SitemapDocument;
  try {
    parsed = parser.parse(body) as SitemapDocument;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({ url: sitemapUrl, message: `Sitemap non valida: ${message}`, fatal: false });
    await processSitemapQueue(site, queue, seenSitemaps, discovered, issues);
    return;
  }

  for (const child of toArray(parsed.sitemapindex?.sitemap)) {
    const loc = textValue(child.loc);
    if (loc) queue.push(loc);
  }

  for (const item of toArray(parsed.urlset?.url)) {
    const loc = textValue(item.loc);
    const normalized = loc ? normalizeUrl(loc, site, sitemapUrl) : undefined;
    if (!normalized || !isSameSite(normalized, site)) continue;
    if (!looksLikeHtmlPage(normalized, site) && !isIncludedFile(normalized, site)) continue;
    discovered.set(normalized, { url: normalized, depth: 0, sourceUrl: sitemapUrl });
    if (discovered.size >= site.crawl.maxUrls) return;
  }

  await processSitemapQueue(site, queue, seenSitemaps, discovered, issues);
}

async function readSitemap(
  site: SiteConfig,
  sitemapUrl: string,
  issues: ScanIssue[]
): Promise<string | undefined> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        accept: "application/xml,text/xml,*/*;q=0.8",
        "user-agent": site.crawl.userAgent
      },
      signal: AbortSignal.timeout(site.crawl.timeoutMs)
    });

    if (!response.ok) {
      issues.push({
        url: sitemapUrl,
        message: `Sitemap non leggibile (${response.status}): ${sitemapUrl}`,
        fatal: false
      });
      return undefined;
    }

    return await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({ url: sitemapUrl, message: `Sitemap non leggibile: ${message}`, fatal: false });
    return undefined;
  }
}

interface SitemapDocument {
  sitemapindex?: { sitemap?: SitemapEntry | SitemapEntry[] };
  urlset?: { url?: SitemapEntry | SitemapEntry[] };
}

interface SitemapEntry {
  loc?: string | { "#text"?: string };
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: string | { "#text"?: string } | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value["#text"];
}
