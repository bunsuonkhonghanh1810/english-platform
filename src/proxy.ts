import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = request.cookies.get("english_platform_session");
  const fullTargetPath = pathname + search;

  // 1. Chặn các route yêu cầu đăng nhập: /exam, /history, /admin
  const isProtectedRoute =
    pathname.startsWith("/exam") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/admin");

  if (isProtectedRoute && !sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", fullTargetPath);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Chặn riêng khu vực /admin: chỉ cho phép role admin
  if (pathname.startsWith("/admin") && sessionCookie?.value) {
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
      loginUrl.searchParams.set("redirect", fullTargetPath);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/exam/:path*",
    "/history",
    "/history/:path*",
  ],
};
