import { NextResponse } from "next/server";

const PIN_COOKIE = "pin_auth";

export async function GET(request: Request) {
  const redirectUrl = new URL("/pin", request.url);
  const isSecure =
    redirectUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
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
