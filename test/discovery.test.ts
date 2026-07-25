import { afterEach, describe, expect, it, vi } from "vitest";
import { RobotsGuard } from "../src/robots.js";
import { discoverFromSitemaps } from "../src/sitemap.js";
import type { ScanIssue, SiteConfig } from "../src/types.js";

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
  trackingParams: [],
  ignoredIssues: []
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RobotsGuard", () => {
  it("tratta robots.txt 4xx come assenza di restrizioni", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 415 })));

    const guard = new RobotsGuard(site);

    await expect(guard.canFetch("https://example.com/pagina")).resolves.toBe(true);
  });

  it("resta fail closed su robots.txt 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));

    const guard = new RobotsGuard(site);

    await expect(guard.canFetch("https://example.com/pagina")).rejects.toThrow("robots.txt non leggibile (503)");
  });
});

describe("discoverFromSitemaps", () => {
  it("registra una sitemap illeggibile come problema non fatale", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 415 })));

    const issues: ScanIssue[] = [];
    const discovered = await discoverFromSitemaps(site, ["https://example.com/sitemap.xml"], issues);

    expect(discovered).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0].fatal).toBe(false);
    expect(issues[0].message).toContain("415");
  });

  it("continua con le altre sitemap dell'indice quando una fallisce", async () => {
    const index = `<?xml version="1.0"?><sitemapindex>
      <sitemap><loc>https://example.com/rotta.xml</loc></sitemap>
      <sitemap><loc>https://example.com/buona.xml</loc></sitemap>
    </sitemapindex>`;
    const buona = `<?xml version="1.0"?><urlset>
      <url><loc>https://example.com/pagina</loc></url>
    </urlset>`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("indice.xml")) return new Response(index, { status: 200 });
        if (url.endsWith("buona.xml")) return new Response(buona, { status: 200 });
        return new Response("", { status: 500 });
      })
    );

    const issues: ScanIssue[] = [];
    const discovered = await discoverFromSitemaps(site, ["https://example.com/indice.xml"], issues);

    expect(discovered.map((item) => item.url)).toEqual(["https://example.com/pagina"]);
    expect(issues).toHaveLength(1);
    expect(issues[0].url).toBe("https://example.com/rotta.xml");
    expect(issues[0].fatal).toBe(false);
  });

  it("continua con le altre sitemap quando una contiene XML malformato", async () => {
    const buona = `<?xml version="1.0"?><urlset>
      <url><loc>https://example.com/pagina</loc></url>
    </urlset>`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => new Response(url.endsWith("buona.xml") ? buona : "<", { status: 200 }))
    );

    const issues: ScanIssue[] = [];
    const discovered = await discoverFromSitemaps(
      site,
      ["https://example.com/rotta.xml", "https://example.com/buona.xml"],
      issues
    );

    expect(discovered.map((item) => item.url)).toEqual(["https://example.com/pagina"]);
    expect(issues).toMatchObject([
      { url: "https://example.com/rotta.xml", fatal: false }
    ]);
  });
});
