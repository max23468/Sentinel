import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadState, saveState } from "../src/storage.js";
import { renderScanReport } from "../src/report.js";
import { scanSite } from "../src/scan.js";
import type { SentinelConfig, SiteConfig } from "../src/types.js";
import { testOutboundClient } from "./outbound-fixture.js";

const { sendScanEmail } = vi.hoisted(() => ({ sendScanEmail: vi.fn() }));

vi.mock("../src/email.js", () => ({ sendScanEmail }));

const tempDirs: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  sendScanEmail.mockReset();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scanSite", () => {
  it("richiede l'email per una sitemap malformata", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "sentinel-scan-"));
    tempDirs.push(rootDir);

    const site: SiteConfig = {
      id: "test",
      name: "Test",
      enabled: true,
      sitemapUrls: ["https://example.com/sitemap.xml"],
      roots: ["https://example.com/"],
      crawl: { maxDepth: 0, maxUrls: 10, timeoutMs: 1000, userAgent: "Sentinel test" },
      includeFileExtensions: [],
      trackingParams: [],
      ignoredIssues: []
    };
    const config: SentinelConfig = {
      version: 1,
      storage: {
        dataDir: path.join(rootDir, "data"),
        snapshotsDir: path.join(rootDir, "snapshots"),
        reportsDir: path.join(rootDir, "reports")
      },
      email: {
        enabled: true,
        defaultProfile: "test",
        fromEnv: "FROM",
        toEnv: "TO",
        subjectPrefix: "[Sentinel]",
        profiles: {}
      },
      sites: [site]
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const value = String(url);
        if (value.endsWith("/robots.txt")) return new Response("", { status: 404 });
        if (value.endsWith("/sitemap.xml")) return new Response("<", { status: 200 });
        return new Response("<html><body>Pagina valida</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" }
        });
      })
    );

    const result = await scanSite(
      config,
      site,
      { dryRun: false },
      testOutboundClient(site, fetch)
    );

    expect(result.issues).toMatchObject([{ url: "https://example.com/sitemap.xml", fatal: false }]);
    expect(result.emailRequired).toBe(true);
    expect(sendScanEmail).toHaveBeenCalledOnce();
  });
});


describe("protezione baseline da scan incompleto", () => {
  async function fixture(known = 12) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sentinel-incomplete-"));
    tempDirs.push(dir);
    const site: SiteConfig = {
      id: "test", name: "Test", enabled: true,
      sitemapUrls: ["https://example.com/sitemap.xml"], roots: ["https://example.com/"],
      crawl: { maxDepth: 0, maxUrls: 100, timeoutMs: 1000, userAgent: "Sentinel test" },
      includeFileExtensions: [], trackingParams: [], ignoredIssues: []
    };
    const config: SentinelConfig = {
      version: 1, sites: [site],
      storage: { dataDir: path.join(dir, "data"), snapshotsDir: path.join(dir, "snapshots"), reportsDir: path.join(dir, "reports") },
      email: { enabled: true, defaultProfile: "test", fromEnv: "FROM", toEnv: "TO", subjectPrefix: "[Sentinel]", profiles: {} }
    };
    const urls = Object.fromEntries(Array.from({ length: known }, (_, i) => {
      const url = i === 0 ? site.roots[0] : `https://example.com/p${i}`;
      return [url, { url, kind: "html" as const, firstSeenAt: "2026-09-26T12:00:00Z", lastSeenAt: "2026-09-26T12:00:00Z", lastStatus: 200, hash: "previous", snapshotIds: [] }];
    }));
    const previous = { version: 1, sites: { test: { id: "test", name: "Test", ...(known ? { lastScanAt: "2026-09-26T12:00:00Z" } : {}), urls } } };
    await saveState(config, previous);
    return { site, config, previous };
  }

  it.each([false, true])("challenge 200 e sitemap 415: nessun falso cambiamento o scrittura (dryRun=%s)", async (dryRun) => {
    const { site, config, previous } = await fixture(2);
    const fakeFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("robots.txt")) return new Response("", { status: 404 });
      if (String(url).endsWith("sitemap.xml")) return new Response("", { status: 415 });
      return new Response('<title>One moment, please...</title><body>Please wait while your request is being verified...</body>', { headers: { "content-type": "text/html" } });
    });
    const result = await scanSite(config, site, { dryRun }, testOutboundClient(site, fakeFetch as typeof fetch));
    expect(result.incomplete).toBe(true);
    expect(result.changes).toEqual([]);
    expect(result.issues.some((issue) => issue.message.includes("verifica anti-bot"))).toBe(true);
    expect(await loadState(config)).toEqual(previous);
    expect(renderScanReport(result)).toContain("Scansione incompleta");
    expect(sendScanEmail).toHaveBeenCalledTimes(dryRun ? 0 : 1);
  });

  it("non crea una baseline iniziale dalla challenge", async () => {
    const { site, config, previous } = await fixture(0);
    const fakeFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("robots.txt")) return new Response("", { status: 404 });
      if (String(url).endsWith("sitemap.xml")) return new Response("", { status: 415 });
      return new Response("verify", { headers: { "content-type": "text/html", "cf-mitigated": "challenge" } });
    });
    const result = await scanSite(config, site, { dryRun: false }, testOutboundClient(site, fakeFetch as typeof fetch));
    expect(result.baseline).toBe(true);
    expect(result.incomplete).toBe(true);
    expect(await loadState(config)).toEqual(previous);
    expect(renderScanReport(result)).not.toContain("Baseline iniziale creata");
  });

  it("sospende confronto e persistenza su crollo copertura anche senza errori HTTP", async () => {
    const { site, config, previous } = await fixture();
    const fakeFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("robots.txt")) return new Response("", { status: 404 });
      if (String(url).endsWith("sitemap.xml")) return new Response("<urlset></urlset>");
      return new Response("<body>New content</body>", { headers: { "content-type": "text/html" } });
    });
    const result = await scanSite(config, site, { dryRun: false }, testOutboundClient(site, fakeFetch as typeof fetch));
    expect(result.incomplete).toBe(true);
    expect(result.changes).toEqual([]);
    expect(await loadState(config)).toEqual(previous);
  });

  it("persiste i cambiamenti reali quando la copertura resta completa", async () => {
    const { site, config } = await fixture(2);
    const fakeFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("robots.txt")) return new Response("", { status: 404 });
      if (String(url).endsWith("sitemap.xml")) return new Response('<urlset><url><loc>https://example.com/p1</loc></url></urlset>');
      return new Response("<body>New content</body>", { headers: { "content-type": "text/html" } });
    });
    const result = await scanSite(config, site, { dryRun: false }, testOutboundClient(site, fakeFetch as typeof fetch));
    expect(result.incomplete).toBe(false);
    expect(result.changes).toHaveLength(2);
    expect((await loadState(config)).sites.test.urls[site.roots[0]].hash).not.toBe("previous");
  });
  it("segnala la challenge HTML della sitemap senza accettare i cambiamenti delle pagine valide", async () => {
    const { site, config, previous } = await fixture(2);
    const fakeFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("robots.txt")) return new Response("", { status: 404 });
      const body = String(url).endsWith("sitemap.xml")
        ? '<title>One moment, please...</title><body>Please wait while your request is being verified...</body>'
        : '<body>Pagina reale aggiornata</body>';
      return new Response(body, { headers: { "content-type": "text/html" } });
    });
    const result = await scanSite(config, site, { dryRun: false }, testOutboundClient(site, fakeFetch as typeof fetch));
    expect(result.incomplete).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("anti-bot della sitemap"))).toBe(true);
    expect(result.changes).toEqual([]);
    expect(await loadState(config)).toEqual(previous);
  });

});
