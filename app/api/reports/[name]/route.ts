import { readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";
import { dashboardReportBlobPath } from "../../../../src/dashboard-publish";
import { resolveFromCwd } from "../../../../src/fs";
import { requireDashboardAuth } from "../../auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    name: string;
  }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const authResponse = requireDashboardAuth(request);
  if (authResponse) return authResponse;

  const { name } = await context.params;
  const fileName = path.basename(name);
  if (fileName !== name || !fileName.endsWith(".md")) {
    return new Response("Report non valido.", { status: 400 });
  }

  const blobResponse = await tryReadReportFromBlob(fileName, request.headers.get("if-none-match"));
  if (blobResponse) return blobResponse;

  try {
    const content = await readFile(resolveFromCwd(path.join("reports", fileName)), "utf8");
    return markdownResponse(content);
  } catch {
    return new Response("Report non trovato.", { status: 404 });
  }
}

async function tryReadReportFromBlob(fileName: string, ifNoneMatch: string | null): Promise<Response | undefined> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;

  const result = await get(dashboardReportBlobPath(fileName), {
    access: "private",
    ifNoneMatch: ifNoneMatch ?? undefined,
    useCache: false
  });

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
