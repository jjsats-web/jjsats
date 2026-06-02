import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";
const ADMIN_PIN = "000000";
const ADMIN_ROLE = "admin";
const FIRST_VISIT_PIN = "first_visit";

const adminOnlyPaths = ["/product", "/pin/register"];
const PREFETCH_HEADERS = ["next-router-prefetch", "x-middleware-prefetch"];
const PREFETCH_PURPOSES = new Set(["prefetch", "prerender"]);

function shouldBypass(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/pin")) return true;
  if (pathname.startsWith("/pin/login")) return true;
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

function isPrefetch(req: NextRequest) {
  for (const header of PREFETCH_HEADERS) {
    if (req.headers.get(header) === "1") {
      return true;
    }
  }
  const purpose = req.headers.get("purpose")?.toLowerCase();
  if (purpose && PREFETCH_PURPOSES.has(purpose)) {
    return true;
  }
  const secPurpose = req.headers.get("sec-purpose")?.toLowerCase();
  if (secPurpose && PREFETCH_PURPOSES.has(secPurpose)) {
    return true;
  }
  return false;
}

function withNoStore(response: NextResponse) {
  response.headers.set("x-middleware-cache", "no-store");
  return response;
}

function normalizeRedirectTo(value: string) {
  if (!value || value === "/" || !value.startsWith("/") || value.startsWith("/pin")) {
    return "/quotation";
  }
  return value;
}


export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const pinCookie = req.cookies.get(PIN_COOKIE)?.value ?? "";
  const roleCookie = req.cookies.get(ROLE_COOKIE)?.value ?? "";
  const hasPin = Boolean(pinCookie && pinCookie !== "ok");
  const isAdmin = roleCookie === ADMIN_ROLE || pinCookie === ADMIN_PIN || pinCookie === FIRST_VISIT_PIN;

  if (isPrefetch(req)) {
    return withNoStore(NextResponse.next());
  }

  if (pathname === "/pin") {
    const nextPath = normalizeRedirectTo(searchParams.get("redirectTo") ?? "");

    if (hasPin) {
      return withNoStore(NextResponse.redirect(new URL(nextPath, req.url)));
    }
    return withNoStore(NextResponse.next());
  }

  if (shouldBypass(req)) {
    return withNoStore(NextResponse.next());
  }

  if (hasPin) {
    if (isAdminOnlyPath(pathname) && !isAdmin) {
      const restrictedUrl = new URL("/restricted", req.url);
      restrictedUrl.searchParams.set("from", req.nextUrl.pathname);
      return withNoStore(NextResponse.redirect(restrictedUrl));
    }
    return withNoStore(NextResponse.next());
  }

  const redirectUrl = new URL("/pin", req.url);
  const requestedPath =
    req.nextUrl.pathname === "/" ? "/quotation" : req.nextUrl.pathname + req.nextUrl.search;
  redirectUrl.searchParams.set("redirectTo", requestedPath);
  return withNoStore(NextResponse.redirect(redirectUrl));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
