import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes strictly
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get("english_platform_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const decoded = Buffer.from(sessionCookie.value, "base64").toString("utf-8");
      const user = JSON.parse(decoded);
      if (user.role !== "admin") {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
