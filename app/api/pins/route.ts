import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";
const MASTER_PIN = "000000";
const ADMIN_ROLE = "admin";

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

export async function GET() {
  if (!(await isMaster())) {
    return NextResponse.json({ error: "สิทธิ์ไม่เพียงพอ" }, { status: 403 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pins")
      .select("id,pin,first_name,last_name,signature_image,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data ?? []).map((row) => toPinEntry(row as PinRow)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
