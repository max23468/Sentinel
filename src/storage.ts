import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchedResource, SentinelConfig, SentinelState, SiteConfig, SiteState, SnapshotDocument, UrlState } from "./types.js";
import { ensureDir, readJsonFile, resolveFromCwd, writeJsonFile } from "./fs.js";
import { urlId } from "./hash.js";
import { timestampForFile } from "./time.js";

const EMPTY_STATE: SentinelState = {
  version: 1,
  sites: {}
};

export function statePath(config: SentinelConfig): string {
  return resolveFromCwd(path.join(config.storage.dataDir, "state.json"));
}

export async function loadState(config: SentinelConfig): Promise<SentinelState> {
  return readJsonFile<SentinelState>(statePath(config), EMPTY_STATE);
}

export async function saveState(config: SentinelConfig, state: SentinelState): Promise<void> {
  await writeJsonFile(statePath(config), state);
}

export function getOrCreateSiteState(state: SentinelState, site: SiteConfig): SiteState {
  state.sites[site.id] ??= {
    id: site.id,
    name: site.name,
    urls: {}
  };
  return state.sites[site.id];
}

export function isInitialBaseline(siteState: SiteState): boolean {
  return !siteState.lastScanAt && Object.keys(siteState.urls).length === 0;
}

export async function writeSnapshot(
  config: SentinelConfig,
  site: SiteConfig,
  resource: FetchedResource
): Promise<string> {
  const urlHash = urlId(resource.url);
  const snapshotId = `${site.id}/${urlHash}/${timestampForFile(new Date(resource.fetchedAt))}.json`;
  const absolutePath = resolveFromCwd(path.join(config.storage.snapshotsDir, snapshotId));
  const document: SnapshotDocument = {
    id: snapshotId,
    capturedAt: resource.fetchedAt,
    url: resource.url,
    kind: resource.kind,
    status: resource.status,
    contentType: resource.contentType,
    contentLength: resource.contentLength,
    etag: resource.etag,
    lastModified: resource.lastModified,
    hash: resource.hash,
    title: resource.title,
    normalizedText: resource.normalizedText
  };

  await ensureDir(path.dirname(absolutePath));
  await writeFile(absolutePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return snapshotId;
}

export async function pruneSnapshots(config: SentinelConfig, snapshotIds: string[], keep = 3): Promise<string[]> {
  const sorted = copySorted(snapshotIds);
  const kept = sorted.slice(-keep);
  const removed = sorted.slice(0, Math.max(0, sorted.length - keep));

  await Promise.all(
    removed.map((snapshotId) =>
      rm(resolveFromCwd(path.join(config.storage.snapshotsDir, snapshotId)), { force: true }).catch(() => undefined)
    )
  );

  return kept;
}

export function toUrlState(resource: FetchedResource, firstSeenAt: string, snapshotIds: string[]): UrlState {
  return {
    url: resource.url,
    kind: resource.kind,
    firstSeenAt,
    lastSeenAt: resource.fetchedAt,
    lastStatus: resource.status,
    contentType: resource.contentType,
    contentLength: resource.contentLength,
    etag: resource.etag,
    lastModified: resource.lastModified,
    hash: resource.hash,
    title: resource.title,
    snapshotIds
  };
}

function copySorted(values: string[]): string[] {
  return Array.from(values).sort();
}
