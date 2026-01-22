import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";
const PIN_LENGTH = 6;

type PinRow = {
  pin: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  signature_image: string | null;
};

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

export async function POST(request: Request) {
  let pin = "";
  try {
    const body = (await request.json()) as { pin?: string };
    pin = (body.pin ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!/^\d+$/.test(pin) || pin.length !== PIN_LENGTH) {
    return NextResponse.json(
      { error: `กรุณากรอก PIN ${PIN_LENGTH} หลัก` },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pins")
      .select("pin,first_name,last_name,role")
      .eq("pin", pin)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    const role = data?.role === "admin" ? "admin" : "user";
    const isSecure = isSecureRequest(request);
    const cookieStore = await cookies();
    cookieStore.set(PIN_COOKIE, pin, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      maxAge: 60 * 60, // 1 hour
    });
    cookieStore.set(ROLE_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      maxAge: 60 * 60, // 1 hour
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(PIN_COOKIE)?.value ?? "";
  if (!pinCookie || pinCookie === "ok") {
    return NextResponse.json({
      firstName: "",
      lastName: "",
      role: "user",
      signatureImage: "",
    });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pins")
      .select("first_name,last_name,role,signature_image")
      .eq("pin", pinCookie)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const record = data as PinRow | null;
    const role = record?.role === "admin" ? "admin" : "user";
    return NextResponse.json({
      firstName: record?.first_name ?? "",
      lastName: record?.last_name ?? "",
      role,
      signatureImage: record?.signature_image ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
