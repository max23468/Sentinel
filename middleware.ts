import { next } from "@vercel/functions";
import { requireDashboardAuth } from "./web/auth";

export const config = {
  matcher: ["/((?!assets/|favicon.svg|favicon.ico).*)"]
};

export default function middleware(request: Request): Response {
  const denied = requireDashboardAuth(request);
  return denied ?? next();
}
