import { readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { urlId } from "../src/hash.js";
import {
  getOrCreateSiteState,
  isInitialBaseline,
  loadState,
  pruneSnapshots,
  saveState,
  statePath,
  toUrlState,
  writeSnapshot
} from "../src/storage.js";
import type { FetchedResource, SentinelConfig, SentinelState, SiteConfig } from "../src/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), prefix)));
  tempDirs.push(dir);
  return dir;
}

function createConfig(rootDir: string): SentinelConfig {
  return {
    version: 1,
    storage: {
      dataDir: path.join(rootDir, "data"),
      snapshotsDir: path.join(rootDir, "snapshots"),
      reportsDir: path.join(rootDir, "reports")
    },
    email: {
      enabled: true,
      defaultProfile: "gmail",
      fromEnv: "SENTINEL_EMAIL_FROM",
      toEnv: "SENTINEL_EMAIL_TO",
      subjectPrefix: "[Sentinel]",
      profiles: {}
    },
    sites: [createSite()]
  };
}

function createSite(): SiteConfig {
  return {
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
    includeFileExtensions: ["pdf"],
    trackingParams: [],
    ignoredIssues: []
  };
}

function createResource(overrides: Partial<FetchedResource> = {}): FetchedResource {
  return {
    url: "https://www.ortix.it/catalogo",
    finalUrl: "https://www.ortix.it/catalogo",
    kind: "html",
    status: 200,
    contentType: "text/html; charset=utf-8",
    contentLength: 321,
    etag: "\"abc\"",
    lastModified: "Mon, 01 Jun 2026 10:00:00 GMT",
    hash: "deadbeef",
    title: "Catalogo Ortix",
    normalizedText: "catalogo aggiornato",
    links: [],
    fetchedAt: "2026-06-02T10:11:12.000Z",
    ...overrides
  };
}

describe("storage", () => {
  it("salva e ricarica lo stato dal percorso configurato", async () => {
    const rootDir = await createTempDir("sentinel-storage-");
    const config = createConfig(rootDir);
    const state: SentinelState = {
      version: 1,
      sites: {
        ortix: {
          id: "ortix",
          name: "Ortix",
          lastScanAt: "2026-06-02T10:11:12.000Z",
          urls: {}
        }
      }
    };

    await saveState(config, state);

    expect(statePath(config)).toBe(path.join(rootDir, "data", "state.json"));
    await expect(loadState(config)).resolves.toEqual(state);
  });

  it("restituisce uno stato vuoto quando il file non esiste", async () => {
    const rootDir = await createTempDir("sentinel-storage-missing-");
    const config = createConfig(rootDir);

    await expect(loadState(config)).resolves.toEqual({
      version: 1,
      sites: {}
    });
  });

  it("inizializza il site state solo alla prima richiesta e rileva la baseline", () => {
    const site = createSite();
    const state: SentinelState = {
      version: 1,
      sites: {}
    };

    const initialSiteState = getOrCreateSiteState(state, site);

    expect(initialSiteState).toEqual({
      id: "ortix",
      name: "Ortix",
      urls: {}
    });
    expect(isInitialBaseline(initialSiteState)).toBe(true);

    initialSiteState.urls.home = {
      url: "https://www.ortix.it/",
      kind: "html",
      firstSeenAt: "2026-06-02T10:00:00.000Z",
      lastSeenAt: "2026-06-02T10:11:12.000Z",
      lastStatus: 200,
      hash: "abc",
      snapshotIds: []
    };

    expect(getOrCreateSiteState(state, site)).toBe(initialSiteState);
    expect(isInitialBaseline(initialSiteState)).toBe(false);
  });

  it("scrive snapshot JSON e costruisce lo stato URL dal resource fetchato", async () => {
    const rootDir = await createTempDir("sentinel-storage-snapshot-");
    const config = createConfig(rootDir);
    const site = createSite();
    const resource = createResource();

    const snapshotId = await writeSnapshot(config, site, resource);
    const snapshotPath = path.join(rootDir, "snapshots", snapshotId);
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as Record<string, unknown>;

    expect(snapshotId).toBe(`ortix/${urlId(resource.url)}/20260602T101112Z.json`);
    expect(snapshot).toMatchObject({
      id: snapshotId,
      capturedAt: resource.fetchedAt,
      url: resource.url,
      hash: resource.hash,
      normalizedText: resource.normalizedText
    });

    expect(toUrlState(resource, "2026-06-01T09:00:00.000Z", [snapshotId])).toMatchObject({
      url: resource.url,
      kind: "html",
      firstSeenAt: "2026-06-01T09:00:00.000Z",
      lastSeenAt: resource.fetchedAt,
      lastStatus: 200,
      hash: resource.hash,
      snapshotIds: [snapshotId]
    });
  });

  it("mantiene solo gli ultimi snapshot e rimuove i precedenti dal filesystem", async () => {
    const rootDir = await createTempDir("sentinel-storage-prune-");
    const config = createConfig(rootDir);
    const snapshotIds = [
      "ortix/a/20260602T100000Z.json",
      "ortix/a/20260602T101000Z.json",
      "ortix/a/20260602T102000Z.json",
      "ortix/a/20260602T103000Z.json"
    ];

    await Promise.all(
      snapshotIds.map(async (snapshotId) => {
        const snapshotPath = path.join(rootDir, "snapshots", snapshotId);
        await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(snapshotPath), { recursive: true }));
        await writeFile(snapshotPath, "{}\n", "utf8");
      })
    );

    await expect(pruneSnapshots(config, snapshotIds, 3)).resolves.toEqual([
      "ortix/a/20260602T101000Z.json",
      "ortix/a/20260602T102000Z.json",
      "ortix/a/20260602T103000Z.json"
    ]);

    await expect(stat(path.join(rootDir, "snapshots", snapshotIds[0]))).rejects.toThrow();
    await expect(stat(path.join(rootDir, "snapshots", snapshotIds[3]))).resolves.toBeDefined();
  });
});
