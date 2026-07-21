import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/pin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PIN_LENGTH = 6;
const ALLOWED_ROLES = ["admin", "user"] as const;

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let pin = "";
  let firstName = "";
  let lastName = "";
  let role: (typeof ALLOWED_ROLES)[number] = "user";
  let signatureImage = "";
  try {
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      pin?: string;
      role?: string;
      signatureImage?: string | null;
    };
    pin = (body.pin ?? "").trim();
    firstName = (body.firstName ?? "").trim();
    lastName = (body.lastName ?? "").trim();
    role = (body.role ?? "user").trim().toLowerCase() as (typeof ALLOWED_ROLES)[number];
    signatureImage = (body.signatureImage ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!firstName || !lastName) return NextResponse.json({ error: "กรุณากรอกชื่อและนามสกุล" }, { status: 400 });
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: `กรุณากรอก PIN ${PIN_LENGTH} หลัก` }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "กรุณาเลือก Role ให้ถูกต้อง" }, { status: 400 });
  if (signatureImage && !signatureImage.startsWith("data:image/")) {
    return NextResponse.json({ error: "ลายเซ็นต้องเป็นไฟล์รูปภาพ" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.rpc("register_pin", {
      input_first_name: firstName,
      input_id: randomUUID(),
      input_last_name: lastName,
      input_pin: pin,
      input_role: role,
      input_signature_image: signatureImage || null,
    });
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: status === 409 ? "PIN นี้ถูกใช้งานแล้ว" : error.message }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถบันทึก PIN ได้" }, { status: 500 });
  }
}
