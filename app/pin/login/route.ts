import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";
const PIN_LENGTH = 6;

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

function buildPinRedirectUrl(request: Request, error = "", redirectTo = "/customer", debug = "") {
  const url = new URL("/pin", request.url);
  if (redirectTo.startsWith("/") && !redirectTo.startsWith("/pin")) {
    url.searchParams.set("redirectTo", redirectTo);
  }
  if (debug === "1") {
    url.searchParams.set("debug", "1");
  }
  if (error) {
    url.searchParams.set("error", error);
  }
  return url;
}

export async function POST(request: Request) {
  let pin = "";
  let redirectTo = "/customer";
  let debug = "";

  try {
    const formData = await request.formData();
    pin = String(formData.get("pin") ?? "").trim();
    redirectTo = String(formData.get("redirectTo") ?? "/customer").trim();
    debug = String(formData.get("debug") ?? "").trim();
  } catch {
    return NextResponse.redirect(buildPinRedirectUrl(request, "Invalid PIN payload"), {
      status: 303,
    });
  }

  if (!/^\d+$/.test(pin) || pin.length !== PIN_LENGTH) {
    return NextResponse.redirect(
      buildPinRedirectUrl(request, `กรุณากรอก PIN ${PIN_LENGTH} หลัก`, redirectTo, debug),
      { status: 303 },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pins")
      .select("role")
      .eq("pin", pin)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.redirect(
        buildPinRedirectUrl(request, error.message, redirectTo, debug),
        { status: 303 },
      );
    }

    if (!data) {
      return NextResponse.redirect(
        buildPinRedirectUrl(request, "PIN ไม่ถูกต้อง", redirectTo, debug),
        { status: 303 },
      );
    }

    const role = data.role === "admin" ? "admin" : "user";
    const destination =
      redirectTo.startsWith("/") && !redirectTo.startsWith("/pin") ? redirectTo : "/customer";
    const response = NextResponse.redirect(new URL(destination, request.url), { status: 303 });
    const isSecure = isSecureRequest(request);

    response.cookies.set(PIN_COOKIE, pin, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      maxAge: 60 * 60,
    });
    response.cookies.set(ROLE_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      maxAge: 60 * 60,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.redirect(buildPinRedirectUrl(request, message, redirectTo, debug), {
      status: 303,
    });
  }
}
