import { XMLParser } from "fast-xml-parser";
import { MAX_SITEMAP_BYTES, type OutboundClient } from "./outbound.js";
import type { QueuedUrl, ScanIssue, SiteConfig } from "./types.js";
import { isIncludedFile, isSameSite, looksLikeHtmlPage, normalizeUrl } from "./url.js";

const MAX_SITEMAPS = 32;
const MAX_SITEMAP_DEPTH = 4;
const MAX_XML_DEPTH = 32;
const MAX_XML_TAGS = 50_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

export async function discoverFromSitemaps(
  site: SiteConfig,
  sitemapUrls: string[],
  issues: ScanIssue[],
  client: OutboundClient
): Promise<QueuedUrl[]> {
  const discovered = new Map<string, QueuedUrl>();
  const seenSitemaps = new Set<string>();
  const queue = sitemapUrls.map((url) => ({ url, depth: 0 }));

  while (queue.length > 0 && discovered.size < site.crawl.maxUrls) {
    const item = queue.shift();
    if (!item || seenSitemaps.has(item.url)) continue;
    if (seenSitemaps.size >= MAX_SITEMAPS) {
      issues.push({ url: item.url, message: `Limite di ${MAX_SITEMAPS} sitemap raggiunto.`, fatal: false });
      break;
    }

    seenSitemaps.add(item.url);
    // Una sitemap illeggibile non ferma la scansione: il crawling dai roots
    // resta la fonte principale, la sitemap aggiunge le pagine non linkate.
    const body = await readSitemap(site, item.url, issues, client);
    if (body === undefined) continue;

    let parsed: SitemapDocument;
    try {
      assertSitemapStructure(body);
      parsed = parser.parse(body) as SitemapDocument;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push({ url: item.url, message: `Sitemap non valida: ${message}`, fatal: false });
      continue;
    }

    let rejectedChild = false;
    for (const child of toArray(parsed.sitemapindex?.sitemap)) {
      const loc = textValue(child.loc);
      const normalized = loc ? normalizeUrl(loc, site, item.url) : undefined;
      if (
        !normalized ||
        !isSameSite(normalized, site) ||
        item.depth >= MAX_SITEMAP_DEPTH ||
        queue.length + seenSitemaps.size >= MAX_SITEMAPS
      ) {
        rejectedChild = true;
        continue;
      }
      queue.push({ url: normalized, depth: item.depth + 1 });
    }
    if (rejectedChild) {
      issues.push({
        url: item.url,
        message: "Sitemap figlia ignorata perché fuori policy o oltre budget.",
        fatal: false
      });
    }

    for (const entry of toArray(parsed.urlset?.url)) {
      const loc = textValue(entry.loc);
      const normalized = loc ? normalizeUrl(loc, site, item.url) : undefined;
      if (!normalized || !isSameSite(normalized, site)) continue;
      if (!looksLikeHtmlPage(normalized, site) && !isIncludedFile(normalized, site)) continue;
      discovered.set(normalized, { url: normalized, depth: 0, sourceUrl: item.url });
      if (discovered.size >= site.crawl.maxUrls) break;
    }
  }

  return [...discovered.values()];
}

async function readSitemap(
  site: SiteConfig,
  sitemapUrl: string,
  issues: ScanIssue[],
  client: OutboundClient
): Promise<string | undefined> {
  try {
    const response = await client.get(sitemapUrl, {
      headers: {
        accept: "application/xml,text/xml,*/*;q=0.8",
        "user-agent": site.crawl.userAgent
      },
      maxBytes: MAX_SITEMAP_BYTES
    });

    if (response.status < 200 || response.status >= 300) {
      issues.push({
        url: sitemapUrl,
        message: `Sitemap non leggibile (${response.status}): ${sitemapUrl}`,
        fatal: false
      });
      return undefined;
    }

    return new TextDecoder().decode(response.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({ url: sitemapUrl, message: `Sitemap non leggibile: ${message}`, fatal: false });
    return undefined;
  }
}

function assertSitemapStructure(body: string): void {
  if (/<!DOCTYPE/i.test(body)) throw new Error("DOCTYPE non consentito");

  let depth = 0;
  let tags = 0;
  for (const match of body.matchAll(/<[^>]*>/g)) {
    if (++tags > MAX_XML_TAGS) throw new Error(`oltre ${MAX_XML_TAGS} tag`);
    const tag = match[0];
    if (tag.startsWith("</")) depth -= 1;
    else if (!tag.startsWith("<!") && !tag.startsWith("<?") && !tag.endsWith("/>")) depth += 1;
    if (depth > MAX_XML_DEPTH) throw new Error(`profondità XML oltre ${MAX_XML_DEPTH}`);
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
