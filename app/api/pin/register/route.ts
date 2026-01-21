import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";
const ADMIN_PIN = "000000";
const ADMIN_ROLE = "admin";
const PIN_LENGTH = 6;
const ALLOWED_ROLES = ["admin", "user"] as const;

type PinRole = (typeof ALLOWED_ROLES)[number];

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(PIN_COOKIE)?.value ?? "";
  const roleCookie = cookieStore.get(ROLE_COOKIE)?.value ?? "";
  if (roleCookie !== ADMIN_ROLE && pinCookie !== ADMIN_PIN) {
    return NextResponse.json({ error: "สิทธิ์ไม่เพียงพอ" }, { status: 403 });
  }

  let pin = "";
  let firstName = "";
  let lastName = "";
  let role: PinRole = "user";
  let signatureImage = "";
  try {
    const body = (await request.json()) as {
      pin?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      signatureImage?: string | null;
    };
    pin = (body.pin ?? "").trim();
    firstName = (body.firstName ?? "").trim();
    lastName = (body.lastName ?? "").trim();
    role = (body.role ?? "user").trim().toLowerCase() as PinRole;
    signatureImage = (body.signatureImage ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "กรุณากรอกชื่อและนามสกุล" }, { status: 400 });
  }

  if (!pin) {
    return NextResponse.json({ error: "กรุณากรอก PIN" }, { status: 400 });
  }

  if (!/^\d+$/.test(pin) || pin.length !== PIN_LENGTH) {
    return NextResponse.json(
      { error: `กรุณากรอก PIN ${PIN_LENGTH} หลัก` },
      { status: 400 },
    );
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "กรุณาเลือก Role ให้ถูกต้อง" }, { status: 400 });
  }

  if (signatureImage && !signatureImage.startsWith("data:image/")) {
    return NextResponse.json({ error: "ลายเซ็นต้องเป็นไฟล์รูปภาพ" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: existing, error: findError } = await supabase
      .from("pins")
      .select("id")
      .eq("pin", pin)
      .limit(1)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ error: "PIN นี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const { error } = await supabase.from("pins").insert({
      id: randomUUID(),
      pin,
      first_name: firstName,
      last_name: lastName,
      signature_image: signatureImage || null,
      role,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
