import { NextRequest, NextResponse } from "next/server";

function matchesCredential(candidate: string, expected: string) {
  const length = Math.max(candidate.length, expected.length);
  let difference = candidate.length ^ expected.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (candidate.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export function proxy(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return new NextResponse("Admin credentials are not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      if (matchesCredential(decoded, `${username}:${password}`)) {
        const response = NextResponse.next();
        response.headers.set("Cache-Control", "no-store, max-age=0");
        return response;
      }
    } catch {
      // Malformed Basic Auth values are handled as unauthenticated requests.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Photeam Orders"' }
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
