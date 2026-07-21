import { NextResponse } from "next/server";

import { getPinSession } from "@/lib/auth/pin";
import { clearPinLoginFailures, pinLoginRetryAfter, recordPinLoginFailure } from "@/lib/auth/pin-rate-limit";
import { setPinSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PIN_LENGTH = 6;

export async function POST(request: Request) {
  let pin = "";
  try {
    const body = (await request.json()) as { pin?: string };
    pin = (body.pin ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    return NextResponse.json({ error: `กรุณากรอก PIN ${PIN_LENGTH} หลัก` }, { status: 400 });
  }

  try {
    const retryAfterSeconds = await pinLoginRetryAfter(request);
    if (retryAfterSeconds > 0) {
      return NextResponse.json(
        { error: `ลองใหม่ได้อีกครั้งใน ${Math.ceil(retryAfterSeconds / 60)} นาที`, retryAfterSeconds },
        { status: 429 },
      );
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("verify_pin", { input_pin: pin });
    const profile = data?.[0];
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!profile) {
      const lockedForSeconds = await recordPinLoginFailure(request);
      return NextResponse.json(
        {
          error: lockedForSeconds > 0 ? `ลองใหม่ได้อีกครั้งใน ${Math.ceil(lockedForSeconds / 60)} นาที` : "PIN ไม่ถูกต้อง",
          retryAfterSeconds: lockedForSeconds || undefined,
        },
        { status: lockedForSeconds > 0 ? 429 : 401 },
      );
    }

    const response = NextResponse.json({ ok: true, role: profile.role === "admin" ? "admin" : "user" });
    await clearPinLoginFailures(request);
    await setPinSession(response, request, {
      role: profile.role === "admin" ? "admin" : "user",
      userId: profile.id,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบ PIN ได้" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getPinSession();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pins")
      .select("first_name,last_name,role,signature_image")
      .eq("id", session.userId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({
      firstName: data.first_name ?? "",
      lastName: data.last_name ?? "",
      role: data.role === "admin" ? "admin" : "user",
      signatureImage: data.signature_image ?? "",
    });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลผู้ใช้ได้" }, { status: 500 });
  }
}
