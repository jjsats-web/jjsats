import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type QuoteItemDraft = {
  description: string;
  qty: number;
  price: number;
};

type QuoteDraft = {
  customerId: string | null;
  companyName: string;
  systemName: string;
  items: QuoteItemDraft[];
  total: number;
  note: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeItems(rawItems: unknown): QuoteItemDraft[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        description: readString(record.description),
        qty: Math.max(0, readNumber(record.qty)),
        price: Math.max(0, readNumber(record.price)),
      };
    })
    .filter((item) => item.description && item.qty > 0);
}

async function readDraft(request: Request): Promise<QuoteDraft | { error: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: "Invalid JSON payload" };
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const companyName = readString(raw.companyName);
  const systemName = readString(raw.systemName);
  const items = normalizeItems(raw.items);
  const note = readOptionalString(raw.note);

  if (!companyName) {
    return { error: "กรุณาไปเลือกรายชื่อลูกค้าก่อน" };
  }

  if (!items.length) {
    return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
  }

  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discount = Math.max(0, readNumber(raw.discount));
  const appliedDiscount = Math.min(discount, subtotal);
  const total = Math.max(subtotal - appliedDiscount, 0);

  return {
    customerId: readString(raw.customerId) || null,
    companyName,
    systemName,
    items,
    total,
    note,
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("quotes")
      .select("id,company_name,system_name,items,total,created_at,customer_id,note")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการดึงประวัติใบเสนอราคา";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const draft = await readDraft(request);
  if ("error" in draft) {
    return NextResponse.json({ error: draft.error }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        id: crypto.randomUUID(),
        customer_id: draft.customerId,
        company_name: draft.companyName,
        system_name: draft.systemName || draft.companyName,
        items: draft.items,
        total: draft.total,
        note: draft.note,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "เกิดข้อผิดพลาดในการบันทึกใบเสนอราคา" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: (data as { id: string }).id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกใบเสนอราคา";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
