import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchResource } from "../src/fetch-resource.js";
import type { SiteConfig } from "../src/types.js";

const site: SiteConfig = {
  id: "test",
  name: "Test",
  enabled: true,
  sitemapUrls: ["https://example.com/sitemap.xml"],
  roots: ["https://example.com/"],
  crawl: {
    maxDepth: 3,
    maxUrls: 500,
    timeoutMs: 30000,
    userAgent: "Sentinel test"
  },
  includeFileExtensions: ["pdf"],
  trackingParams: []
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchResource", () => {
  it("tratta content-type non HTML come file anche senza estensione", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "application/pdf" },
        status: 200
      }))
    );

    const resource = await fetchResource("https://example.com/download", site, 0);

    expect(resource.kind).toBe("file");
    expect(resource.normalizedText).toBeUndefined();
    expect(resource.hash).toHaveLength(64);
  });
});
