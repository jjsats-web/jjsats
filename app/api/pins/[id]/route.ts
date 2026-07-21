import { NextResponse } from "next/server";

import { getPinSession, requireAdmin } from "@/lib/auth/pin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PIN_LENGTH = 6;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const pin = readString(body.pin);
  const firstName = readString(body.firstName);
  const lastName = readString(body.lastName);
  const hasSignatureImage = Object.prototype.hasOwnProperty.call(body, "signatureImage");
  const signatureImage = readString(body.signatureImage);

  if (!firstName || !lastName) return NextResponse.json({ error: "กรุณากรอกชื่อและนามสกุล" }, { status: 400 });
  if (pin && !/^\d{6}$/.test(pin)) return NextResponse.json({ error: `กรุณากรอก PIN ${PIN_LENGTH} หลัก` }, { status: 400 });
  if (hasSignatureImage && signatureImage && !signatureImage.startsWith("data:image/")) {
    return NextResponse.json({ error: "ลายเซ็นต้องเป็นไฟล์รูปภาพ" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_pin", {
      input_first_name: firstName,
      input_id: id,
      input_last_name: lastName,
      input_pin: pin || null,
      input_signature_image: signatureImage || null,
      replace_signature: hasSignatureImage,
    });
    const updated = data?.[0];
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: status === 409 ? "PIN นี้ถูกใช้งานแล้ว" : error.message }, { status });
    }
    if (!updated) return NextResponse.json({ error: "ไม่พบ PIN" }, { status: 404 });
    return NextResponse.json({
      createdAt: updated.created_at ?? "",
      firstName: updated.first_name ?? "",
      id: updated.id,
      lastName: updated.last_name ?? "",
      signatureImage: updated.signature_image ?? "",
    });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถแก้ไข PIN ได้" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const session = await getPinSession();
  const { id } = await context.params;
  if (session.userId === id) {
    return NextResponse.json({ error: "ไม่สามารถลบบัญชี PIN ที่กำลังใช้งานอยู่ได้" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from("pins").delete().eq("id", id).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "ไม่พบ PIN" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถลบ PIN ได้" }, { status: 500 });
  }
}
