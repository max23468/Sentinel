import { describe, expect, it } from "vitest";
import type { SiteConfig } from "../src/types.js";
import { isIncludedFile, isSameSite, normalizeUrl } from "../src/url.js";

const site: SiteConfig = {
  id: "ortix",
  name: "Ortix",
  enabled: true,
  sitemapUrls: ["https://www.ortix.it/sitemap_index.xml"],
  roots: ["https://www.ortix.it/"],
  crawl: {
    maxDepth: 3,
    maxUrls: 500,
    timeoutMs: 30000,
    userAgent: "Sentinel test"
  },
  includeFileExtensions: ["pdf", "png"],
  trackingParams: ["fbclid", "source"]
};

describe("URL normalization", () => {
  it("rimuove tracking, hash e slash finale equivalente", () => {
    expect(normalizeUrl("https://www.ortix.it/prova/?utm_source=x&b=2&a=1#top", site)).toBe(
      "https://www.ortix.it/prova?a=1&b=2"
    );
  });

  it("risolve URL relativi e filtra protocolli non web", () => {
    expect(normalizeUrl("/documento.pdf?fbclid=1", site, "https://www.ortix.it/base/")).toBe(
      "https://www.ortix.it/documento.pdf"
    );
    expect(normalizeUrl("mailto:test@example.com", site)).toBeUndefined();
  });

  it("riconosce dominio e file inclusi", () => {
    expect(isSameSite("https://www.ortix.it/a", site)).toBe(true);
    expect(isSameSite("https://example.com/a", site)).toBe(false);
    expect(isIncludedFile("https://www.ortix.it/file.PDF", site)).toBe(true);
  });
});
