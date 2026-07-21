import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { PIN_SESSION_COOKIE, verifyPinSessionToken } from "@/lib/auth/session";

const adminOnlyPaths = ["/product", "/pin/register", "/pin/manage"];
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
  return adminOnlyPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPrefetch(req: NextRequest) {
  for (const header of PREFETCH_HEADERS) {
    if (req.headers.get(header) === "1") return true;
  }
  const purpose = req.headers.get("purpose")?.toLowerCase();
  if (purpose && PREFETCH_PURPOSES.has(purpose)) return true;
  const secPurpose = req.headers.get("sec-purpose")?.toLowerCase();
  return Boolean(secPurpose && PREFETCH_PURPOSES.has(secPurpose));
}

function withNoStore(response: NextResponse) {
  response.headers.set("x-middleware-cache", "no-store");
  return response;
}

function normalizeRedirectTo(value: string) {
  if (!value || value === "/" || !value.startsWith("/") || value.startsWith("/pin")) return "/quotation";
  return value;
}

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (isPrefetch(req) || shouldBypass(req)) return withNoStore(NextResponse.next());

  const session = await verifyPinSessionToken(req.cookies.get(PIN_SESSION_COOKIE)?.value);
  if (pathname === "/pin") {
    if (session) {
      return withNoStore(NextResponse.redirect(new URL(normalizeRedirectTo(searchParams.get("redirectTo") ?? ""), req.url)));
    }
    return withNoStore(NextResponse.next());
  }

  if (session) {
    if (isAdminOnlyPath(pathname) && session.role !== "admin") {
      const restrictedUrl = new URL("/restricted", req.url);
      restrictedUrl.searchParams.set("from", req.nextUrl.pathname);
      return withNoStore(NextResponse.redirect(restrictedUrl));
    }
    return withNoStore(NextResponse.next());
  }

  const redirectUrl = new URL("/pin", req.url);
  const requestedPath = pathname === "/" ? "/quotation" : `${pathname}${req.nextUrl.search}`;
  redirectUrl.searchParams.set("redirectTo", requestedPath);
  return withNoStore(NextResponse.redirect(redirectUrl));
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
