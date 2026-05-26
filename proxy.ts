import { NextResponse, type NextRequest } from "next/server";

const REALM = "Sentinel Dashboard";

export function proxy(request: NextRequest): NextResponse {
  const expectedUser = process.env.SENTINEL_DASHBOARD_USER;
  const expectedPassword = process.env.SENTINEL_DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    if (process.env.NODE_ENV === "development") return NextResponse.next();
    return new NextResponse("Dashboard non configurata.", { status: 503 });
  }

  const credentials = readBasicCredentials(request.headers.get("authorization"));
  if (!credentials) return unauthorized();

  if (!safeEqual(credentials.user, expectedUser) || !safeEqual(credentials.password, expectedPassword)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

function unauthorized(): NextResponse {
  return new NextResponse("Autenticazione richiesta.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`
    }
  });
}

function readBasicCredentials(header: string | null): { user: string; password: string } | undefined {
  if (!header?.startsWith("Basic ")) return undefined;

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return undefined;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) return undefined;

  return {
    user: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1)
  };
}

function safeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}
