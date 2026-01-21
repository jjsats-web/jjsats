import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";
const MASTER_PIN = "000000";
const ADMIN_ROLE = "admin";
const PIN_LENGTH = 6;

type PinRow = {
  id: string;
  pin: string | null;
  first_name: string | null;
  last_name: string | null;
  signature_image: string | null;
  created_at: string | null;
};

type PinEntry = {
  id: string;
  pin: string;
  firstName: string;
  lastName: string;
  signatureImage: string;
  createdAt: string;
};

async function isMaster() {
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(PIN_COOKIE)?.value ?? "";
  const roleCookie = cookieStore.get(ROLE_COOKIE)?.value ?? "";
  return roleCookie === ADMIN_ROLE || pinCookie === MASTER_PIN;
}

function toPinEntry(row: PinRow): PinEntry {
  return {
    id: row.id,
    pin: row.pin ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    signatureImage: row.signature_image ?? "",
    createdAt: row.created_at ?? "",
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!(await isMaster())) {
    return NextResponse.json({ error: "สิทธิ์ไม่เพียงพอ" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const pin = readString(raw.pin);
  const firstName = readString(raw.firstName);
  const lastName = readString(raw.lastName);
  const hasSignatureImage = Object.prototype.hasOwnProperty.call(raw, "signatureImage");
  const signatureImage = readString(raw.signatureImage);

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "กรุณากรอกชื่อและนามสกุล" }, { status: 400 });
  }

  if (!/^\d+$/.test(pin) || pin.length !== PIN_LENGTH) {
    return NextResponse.json({ error: `กรุณากรอก PIN ${PIN_LENGTH} หลัก` }, { status: 400 });
  }

  if (hasSignatureImage && signatureImage && !signatureImage.startsWith("data:image/")) {
    return NextResponse.json({ error: "ลายเซ็นต้องเป็นไฟล์รูปภาพ" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: existing, error: findError } = await supabase
      .from("pins")
      .select("id")
      .eq("pin", pin)
      .neq("id", id)
      .limit(1)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ error: "PIN นี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const updatePayload: Record<string, string | null> = {
      pin,
      first_name: firstName,
      last_name: lastName,
    };

    if (hasSignatureImage) {
      updatePayload.signature_image = signatureImage || null;
    }

    const { data, error } = await supabase
      .from("pins")
      .update(updatePayload)
      .eq("id", id)
      .select("id,pin,first_name,last_name,signature_image,created_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "ไม่พบ PIN" }, { status: 404 });
    }

    return NextResponse.json(toPinEntry(data as PinRow));
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!(await isMaster())) {
    return NextResponse.json({ error: "สิทธิ์ไม่เพียงพอ" }, { status: 403 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pins")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "ไม่พบ PIN" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
