import { NextResponse } from "next/server";

import { setPinSession } from "@/lib/auth/session";
import { clearPinLoginFailures, pinLoginRetryAfter, recordPinLoginFailure } from "@/lib/auth/pin-rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getRedirectBase(request: Request) {
  const host = request.headers.get("host") || "localhost:3000";
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return `${url.protocol === "https:" || forwardedProto === "https" ? "https" : "http"}://${host}`;
}

function buildPinRedirectUrl(request: Request, error = "", redirectTo = "/quotation", debug = "") {
  const url = new URL("/pin", getRedirectBase(request));
  if (redirectTo && redirectTo !== "/" && redirectTo.startsWith("/") && !redirectTo.startsWith("/pin")) {
    url.searchParams.set("redirectTo", redirectTo);
  }
  if (debug === "1") url.searchParams.set("debug", "1");
  if (error) url.searchParams.set("error", error);
  return url;
}

export async function POST(request: Request) {
  let pin = "";
  let redirectTo = "/quotation";
  let debug = "";

  try {
    const formData = await request.formData();
    pin = String(formData.get("pin") ?? "").trim();
    redirectTo = String(formData.get("redirectTo") ?? "/quotation").trim();
    debug = String(formData.get("debug") ?? "").trim();
  } catch {
    return NextResponse.redirect(buildPinRedirectUrl(request, "Invalid PIN payload"), { status: 303 });
  }

  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.redirect(buildPinRedirectUrl(request, "กรุณากรอก PIN 6 หลัก", redirectTo, debug), { status: 303 });
  }

  try {
    const retryAfterSeconds = await pinLoginRetryAfter(request);
    if (retryAfterSeconds > 0) {
      return NextResponse.redirect(
        buildPinRedirectUrl(request, `ลองใหม่ได้อีกครั้งใน ${Math.ceil(retryAfterSeconds / 60)} นาที`, redirectTo, debug),
        { status: 303 },
      );
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("verify_pin", { input_pin: pin });
    const profile = data?.[0];
    if (error) {
      return NextResponse.redirect(buildPinRedirectUrl(request, error.message, redirectTo, debug), { status: 303 });
    }
    if (!profile) {
      const lockedForSeconds = await recordPinLoginFailure(request);
      const error = lockedForSeconds > 0
        ? `ลองใหม่ได้อีกครั้งใน ${Math.ceil(lockedForSeconds / 60)} นาที`
        : "PIN ไม่ถูกต้อง";
      return NextResponse.redirect(buildPinRedirectUrl(request, error, redirectTo, debug), { status: 303 });
    }

    const destination = redirectTo && redirectTo !== "/" && redirectTo.startsWith("/") && !redirectTo.startsWith("/pin")
      ? redirectTo
      : "/quotation";
    const response = NextResponse.redirect(new URL(destination, getRedirectBase(request)), { status: 303 });
    await clearPinLoginFailures(request);
    await setPinSession(response, request, {
      role: profile.role === "admin" ? "admin" : "user",
      userId: profile.id,
    });
    return response;
  } catch {
    return NextResponse.redirect(buildPinRedirectUrl(request, "ไม่สามารถเข้าสู่ระบบได้", redirectTo, debug), { status: 303 });
  }
}
