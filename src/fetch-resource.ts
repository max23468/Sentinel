import type { FetchedResource, SiteConfig } from "./types.js";
import { sha256 } from "./hash.js";
import { MAX_FILE_BYTES, MAX_HTML_BYTES, type OutboundClient } from "./outbound.js";
import { extractNormalizedText } from "./text.js";
import { isIncludedFile, isSameSite, normalizeFinalUrl, normalizeUrl } from "./url.js";

export async function fetchResource(
  rawUrl: string,
  site: SiteConfig,
  depth: number,
  client: OutboundClient,
  sourceUrl?: string
): Promise<FetchedResource> {
  const response = await client.get(rawUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": site.crawl.userAgent
    },
    maxBytes: (url, headers) =>
      isHtmlResponse(url, headers.get("content-type") ?? undefined, site)
        ? MAX_HTML_BYTES
        : MAX_FILE_BYTES
  });

  const finalUrl = normalizeFinalUrl(response.url, site);
  if (!finalUrl) throw new Error(`URL finale non valido: ${response.url}`);

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

  if (response.status < 200 || response.status >= 300) {
    return {
      ...base,
      kind: isIncludedFile(finalUrl, site) ? "file" : "html",
      hash: "",
      discoveredUrls: []
    };
  }

  if (isHtmlResponse(finalUrl, contentType, site)) {
    const html = new TextDecoder().decode(response.body);
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

  return {
    ...base,
    kind: "file",
    hash: sha256(response.body),
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
