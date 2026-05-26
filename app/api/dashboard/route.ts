import { loadDashboardModel } from "../../../src/dashboard-publish";
import { requireDashboardAuth } from "../auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const authResponse = requireDashboardAuth(request);
  if (authResponse) return authResponse;

  const model = await loadDashboardModel();
  return Response.json(model, {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
