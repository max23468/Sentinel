import { XMLParser } from "fast-xml-parser";
import type { QueuedUrl, SiteConfig } from "./types.js";
import { isIncludedFile, isSameSite, looksLikeHtmlPage, normalizeUrl } from "./url.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

export async function discoverFromSitemaps(site: SiteConfig, sitemapUrls: string[]): Promise<QueuedUrl[]> {
  const discovered = new Map<string, QueuedUrl>();
  const seenSitemaps = new Set<string>();
  const queue = [...sitemapUrls];

  while (queue.length > 0) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);

    const response = await fetch(sitemapUrl, {
      headers: {
        accept: "application/xml,text/xml,*/*;q=0.8",
        "user-agent": site.crawl.userAgent
      },
      signal: AbortSignal.timeout(site.crawl.timeoutMs)
    });

    if (!response.ok) throw new Error(`Sitemap non leggibile (${response.status}): ${sitemapUrl}`);

    const parsed = parser.parse(await response.text()) as SitemapDocument;
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
      if (discovered.size >= site.crawl.maxUrls) return [...discovered.values()];
    }
  }

  return [...discovered.values()];
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
