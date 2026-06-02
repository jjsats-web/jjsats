import { NextResponse } from "next/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isSecureRequest(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const isSecureProtocol = url.protocol === "https:" || forwardedProto === "https";
  return isSecureProtocol && !isLocalhost(url.hostname);
}

function getRedirectBase(request: Request) {
  const host = request.headers.get("host") || "localhost:3000";
  const url = new URL(request.url);
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const isSecure = url.protocol === "https:" || forwardedProto === "https";
  return `${isSecure ? "https" : "http"}://${host}`;
}

export async function GET(request: Request) {
  const redirectBase = getRedirectBase(request);
  const redirectUrl = new URL("/pin", redirectBase);
  const isSecure = isSecureRequest(request);
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set(PIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    maxAge: 0,
  });
  res.cookies.set(ROLE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    maxAge: 0,
  });
  return res;
}
