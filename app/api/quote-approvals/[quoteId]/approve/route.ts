import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PIN_COOKIE = "pin_auth";
const ADMIN_PINS = new Set(["000000", "111111", "222222"]);

type PinRow = {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readAdminProfile(pin: string) {
  if (!pin || pin === "ok") return { isAdmin: false, name: "" };
  if (ADMIN_PINS.has(pin)) return { isAdmin: true, name: "" };

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("pins")
    .select("first_name,last_name,role")
    .eq("pin", pin)
    .limit(1)
    .maybeSingle();

  const record = data as PinRow | null;
  const role = record?.role === "admin" ? "admin" : "user";
  const firstName = readString(record?.first_name);
  const lastName = readString(record?.last_name);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  return { isAdmin: role === "admin", name };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  if (!quoteId) {
    return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(PIN_COOKIE)?.value ?? "";
  if (!pinCookie || pinCookie === "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const profile = await readAdminProfile(pinCookie);
    if (!profile.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: approval, error: approvalError } = await supabase
      .from("quote_approvals")
      .select("id,status")
      .eq("quote_id", quoteId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (approvalError) {
      return NextResponse.json({ error: approvalError.message }, { status: 500 });
    }

    if (!approval) {
      return NextResponse.json({ error: "ไม่พบคำขออนุมัติ" }, { status: 404 });
    }

    if (approval.status === "approved") {
      return NextResponse.json({ status: "approved" });
    }

    const approverName = readOptionalString(profile.name);
    const { error: updateError } = await supabase
      .from("quote_approvals")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: approverName,
      })
      .eq("id", approval.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ status: "approved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอนุมัติ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
