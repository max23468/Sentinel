import { readFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { buildDashboardModel, readLatestReportSummaries, type DashboardModel, type DashboardReportSummary } from "./dashboard.js";
import { loadConfig } from "./config.js";
import { resolveFromCwd } from "./fs.js";
import { loadState } from "./storage.js";
import type { SentinelConfig, SentinelState } from "./types.js";

const DEFAULT_BLOB_PREFIX = "sentinel-dashboard";
const DASHBOARD_FILE = "dashboard.html";

export interface DashboardBundle {
  model: DashboardModel;
  reports: DashboardReportSummary[];
}

export interface PublishDashboardResult {
  modelPath: string;
  reportCount: number;
  createdAt: string;
}

export function dashboardBlobPrefix(): string {
  const rawPrefix = process.env.SENTINEL_DASHBOARD_BLOB_PREFIX ?? DEFAULT_BLOB_PREFIX;
  return rawPrefix.replace(/^\/+|\/+$/g, "") || DEFAULT_BLOB_PREFIX;
}

export function dashboardModelBlobPath(prefix = dashboardBlobPrefix()): string {
  return `${prefix}/model.json`;
}

export function dashboardReportBlobPath(fileName: string, prefix = dashboardBlobPrefix()): string {
  return `${prefix}/reports/${path.basename(fileName)}`;
}

export async function buildDashboardBundle(
  config: SentinelConfig,
  state: SentinelState,
  createdAt = new Date().toISOString()
): Promise<DashboardBundle> {
  const outputPath = resolveFromCwd(path.join(config.storage.reportsDir, DASHBOARD_FILE));
  const reports = await readLatestReportSummaries(config, outputPath, {
    linkHrefFor: (fileName) => `/api/reports/${encodeURIComponent(fileName)}`
  });
  const webReports = reports.map((report) => ({
    ...report,
    filePath: path.basename(report.filePath)
  }));

  return {
    model: buildDashboardModel(config, state, webReports, createdAt),
    reports
  };
}

export async function loadDashboardModel(): Promise<DashboardModel> {
  const blobModel = await tryLoadDashboardModelFromBlob();
  if (blobModel) return blobModel;

  const config = await loadConfig("sentinel.config.yml");
  const state = await loadState(config);
  return (await buildDashboardBundle(config, state)).model;
}

export async function publishDashboardData(config: SentinelConfig, state: SentinelState): Promise<PublishDashboardResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN mancante: collega un Vercel Blob privato o esporta il token prima di pubblicare.");
  }

  const createdAt = new Date().toISOString();
  const prefix = dashboardBlobPrefix();
  const bundle = await buildDashboardBundle(config, state, createdAt);
  const modelPath = dashboardModelBlobPath(prefix);

  await put(modelPath, `${JSON.stringify(bundle.model, null, 2)}\n`, {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60
  });

  await Promise.all(
    bundle.reports.map(async (report) => {
      const fileName = path.basename(report.filePath);
      const content = await readFile(report.filePath, "utf8");
      await put(dashboardReportBlobPath(fileName, prefix), content, {
        access: "private",
        allowOverwrite: true,
        contentType: "text/markdown; charset=utf-8",
        cacheControlMaxAge: 60
      });
    })
  );

  return {
    modelPath,
    reportCount: bundle.reports.length,
    createdAt
  };
}

async function tryLoadDashboardModelFromBlob(): Promise<DashboardModel | undefined> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;

  const result = await get(dashboardModelBlobPath(), {
    access: "private",
    useCache: false
  });

  if (!result || result.statusCode !== 200) return undefined;

  const body = await new Response(result.stream).text();
  return JSON.parse(body) as DashboardModel;
}
