import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
