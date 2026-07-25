import { loadDashboardModel } from "../src/dashboard-publish.js";
import { requireDashboardAuth } from "../web/auth.js";

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
