import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";
import { dashboardReportBlobPath, dashboardReportOutputUrl } from "../../src/dashboard-publish.js";
import { resolveFromCwd } from "../../src/fs.js";
import { requireDashboardAuth } from "../../web/auth.js";

const localReportsPromise = loadLocalReports();

export async function GET(request: Request): Promise<Response> {
  const authResponse = requireDashboardAuth(request);
  if (authResponse) return authResponse;

  const name = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
  const fileName = path.basename(name);
  if (fileName !== name || !fileName.endsWith(".md")) {
    return new Response("Report non valido.", { status: 400 });
  }

  const blobResponse = await tryReadReportFromBlob(fileName, request.headers.get("if-none-match"));
  if (blobResponse) return blobResponse;

  const localReports = await localReportsPromise;
  const content = localReports.get(fileName);
  if (content) return markdownResponse(content);

  const outputResponse = await tryReadReportFromOutputs(fileName);
  return outputResponse ?? new Response("Report non trovato.", { status: 404 });
}

async function tryReadReportFromOutputs(fileName: string): Promise<Response | undefined> {
  try {
    const response = await fetch(dashboardReportOutputUrl(fileName));
    if (!response.ok) return undefined;
    return markdownResponse(await response.text());
  } catch {
    return undefined;
  }
}

async function tryReadReportFromBlob(fileName: string, ifNoneMatch: string | null): Promise<Response | undefined> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;

  let result;
  try {
    result = await get(dashboardReportBlobPath(fileName), {
      access: "private",
      ifNoneMatch: ifNoneMatch ?? undefined,
      useCache: false
    });
  } catch {
    return undefined;
  }

  if (!result) return undefined;

  if (result.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache"
      }
    });
  }

  return new Response(result.stream, {
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type": result.blob.contentType,
      ETag: result.blob.etag
    }
  });
}

function markdownResponse(content: string): Response {
  return new Response(content, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/markdown; charset=utf-8"
    }
  });
}

async function loadLocalReports(): Promise<Map<string, string>> {
  const reportsDir = resolveFromCwd("reports");

  try {
    const entries = await readdir(reportsDir, { withFileTypes: true });
    const reportReads: Promise<readonly [string, string]>[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      reportReads.push(readLocalReportEntry(reportsDir, entry.name));
    }

    const reports = await Promise.all(reportReads);

    return new Map(reports);
  } catch {
    return new Map();
  }
}

async function readLocalReportEntry(reportsDir: string, fileName: string): Promise<readonly [string, string]> {
  return [fileName, await readFile(path.join(reportsDir, fileName), "utf8")] as const;
}
