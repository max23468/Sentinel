import type { FetchedResource, SiteConfig } from "./types.js";
import { sha256 } from "./hash.js";
import { extractNormalizedText } from "./text.js";
import { isIncludedFile, isSameSite, normalizeFinalUrl, normalizeUrl } from "./url.js";

export async function fetchResource(rawUrl: string, site: SiteConfig, depth: number, sourceUrl?: string): Promise<FetchedResource> {
  const response = await fetch(rawUrl, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": site.crawl.userAgent
    },
    signal: AbortSignal.timeout(site.crawl.timeoutMs)
  });

  const responseUrl = response.url || rawUrl;
  const finalUrl = normalizeFinalUrl(responseUrl, site);
  if (!finalUrl || !isSameSite(finalUrl, site)) {
    throw new Error(`Redirect fuori dominio: ${rawUrl} -> ${responseUrl}`);
  }

  const contentType = response.headers.get("content-type") ?? undefined;
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
  const base = {
    url: finalUrl,
    sourceUrl,
    depth,
    status: response.status,
    contentType,
    contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
    etag: response.headers.get("etag") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
    fetchedAt: new Date().toISOString()
  };

  if (!response.ok) {
    return {
      ...base,
      kind: isIncludedFile(finalUrl, site) ? "file" : "html",
      hash: "",
      discoveredUrls: []
    };
  }

  if (isHtmlResponse(finalUrl, contentType, site)) {
    const html = await response.text();
    const extracted = extractNormalizedText(html);
    const discoveredUrls = new Set<string>();
    for (const candidateUrl of [...extracted.links, ...extracted.assets]) {
      const normalizedUrl = normalizeUrl(candidateUrl, site, finalUrl);
      if (!normalizedUrl || !isSameSite(normalizedUrl, site)) continue;
      discoveredUrls.add(normalizedUrl);
    }

    return {
      ...base,
      kind: "html",
      hash: sha256(extracted.text),
      title: extracted.title,
      normalizedText: extracted.text,
      discoveredUrls: [...discoveredUrls]
    };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    ...base,
    kind: "file",
    hash: sha256(bytes),
    discoveredUrls: []
  };
}

function isHtmlResponse(url: string, contentType: string | undefined, site: SiteConfig): boolean {
  if (contentType) {
    const mediaType = contentType.split(";")[0].trim().toLowerCase();
    return mediaType === "text/html" || mediaType === "application/xhtml+xml";
  }
  return !isIncludedFile(url, site);
}
