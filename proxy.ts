import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";
const ADMIN_PIN = "000000";
const ADMIN_ROLE = "admin";

const adminOnlyPaths = ["/product", "/pin/register"];

function shouldBypass(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/pin")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/manifest.webmanifest") return true;
  if (pathname === "/sw.js") return true;
  return false;
}

function isAdminOnlyPath(pathname: string) {
  return adminOnlyPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const pinCookie = req.cookies.get(PIN_COOKIE)?.value ?? "";
  const roleCookie = req.cookies.get(ROLE_COOKIE)?.value ?? "";
  const hasPin = Boolean(pinCookie);
  const isAdmin = roleCookie === ADMIN_ROLE || pinCookie === ADMIN_PIN;

  if (pathname === "/pin") {
    if (hasPin) {
      const redirectTo = searchParams.get("redirectTo") ?? "";
      const nextPath =
        redirectTo.startsWith("/") && !redirectTo.startsWith("/pin") ? redirectTo : "/customer";
      return NextResponse.redirect(new URL(nextPath, req.url));
    }
    return NextResponse.next();
  }

  if (shouldBypass(req)) {
    return NextResponse.next();
  }

  if (hasPin) {
    if (isAdminOnlyPath(pathname) && !isAdmin) {
      const restrictedUrl = new URL("/restricted", req.url);
      restrictedUrl.searchParams.set("from", req.nextUrl.pathname);
      return NextResponse.redirect(restrictedUrl);
    }
    return NextResponse.next();
  }

  const redirectUrl = new URL("/pin", req.url);
  redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};


