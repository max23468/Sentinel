import type { SiteConfig } from "./types.js";

const DEFAULT_TRACKING_PREFIXES = ["utm_"];

export function normalizeUrl(rawUrl: string, site: SiteConfig, baseUrl?: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, baseUrl);
  } catch {
    return undefined;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return undefined;

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  const trackingParams = new Set(site.trackingParams.map((param) => param.toLowerCase()));
  const entries = [...parsed.searchParams.entries()]
    .filter(([key]) => {
      const normalizedKey = key.toLowerCase();
      if (trackingParams.has(normalizedKey)) return false;
      return !DEFAULT_TRACKING_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix));
    })
    .sort(([left], [right]) => left.localeCompare(right));

  parsed.search = "";
  for (const [key, value] of entries) {
    parsed.searchParams.append(key, value);
  }

  parsed.pathname = normalizePathname(parsed.pathname);

  return parsed.toString();
}

export function normalizeFinalUrl(rawUrl: string, site: SiteConfig): string | undefined {
  return normalizeUrl(rawUrl, site);
}

export function isSameSite(url: string, site: SiteConfig): boolean {
  const target = new URL(url);
  return site.roots.some((root) => {
    const rootUrl = new URL(root);
    return target.protocol === rootUrl.protocol && target.hostname === rootUrl.hostname;
  });
}

export function getExtension(url: string): string | undefined {
  const pathname = new URL(url).pathname.toLowerCase();
  const lastSegment = pathname.split("/").pop();
  if (!lastSegment || !lastSegment.includes(".")) return undefined;
  return lastSegment.split(".").pop() || undefined;
}

export function isIncludedFile(url: string, site: SiteConfig): boolean {
  const extension = getExtension(url);
  if (!extension) return false;
  return site.includeFileExtensions.map((value) => value.toLowerCase()).includes(extension);
}

export function looksLikeHtmlPage(url: string, site: SiteConfig): boolean {
  const extension = getExtension(url);
  if (!extension) return true;
  return !isIncludedFile(url, site);
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const withoutRepeatedSlash = pathname.replace(/\/{2,}/g, "/");
  const withoutTrailingSlash = withoutRepeatedSlash.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}
