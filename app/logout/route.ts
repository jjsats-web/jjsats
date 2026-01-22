import { NextResponse } from "next/server";

const PIN_COOKIE = "pin_auth";

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

export async function GET(request: Request) {
  const redirectUrl = new URL("/pin", request.url);
  const isSecure = isSecureRequest(request);
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set(PIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    maxAge: 0,
  });
  return res;
}
