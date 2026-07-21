import { NextResponse } from "next/server";

import { getPinSession } from "@/lib/auth/pin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VAT_RATE = 7;

type QuoteItemDraft = {
  description: string;
  discount: number;
  lineTotal: number;
  price: number;
  qty: number;
};

type QuoteDraft = {
  companyName: string;
  customerId: string | null;
  discountTotal: number;
  grandTotal: number;
  items: QuoteItemDraft[];
  note: string | null;
  subtotal: number;
  systemName: string;
  taxableTotal: number;
  vatTotal: number;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeItems(rawItems: unknown): QuoteItemDraft[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const qty = Math.max(0, readNumber(record.qty));
      const price = Math.max(0, readNumber(record.price));
      const discount = Math.min(100, Math.max(0, readNumber(record.discount)));
      const lineTotal = roundMoney(qty * price * (1 - discount / 100));
      return { description: readString(record.description), discount, lineTotal, price, qty };
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
  if (!companyName) return { error: "กรุณาเลือกลูกค้าก่อน" };
  if (!items.length) return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.qty * item.price, 0));
  const taxableTotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountTotal = roundMoney(subtotal - taxableTotal);
  const vatTotal = roundMoney(taxableTotal * (VAT_RATE / 100));

  return {
    companyName,
    customerId: readString(raw.customerId) || null,
    discountTotal,
    grandTotal: roundMoney(taxableTotal + vatTotal),
    items,
    note: readOptionalString(raw.note),
    subtotal,
    systemName: systemName || companyName,
    taxableTotal,
    vatTotal,
  };
}

export async function GET() {
  const session = await getPinSession();
  if (!session.isAuthenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { count } = await supabase.from("quotes").select("id", { count: "exact", head: true });
    const { data, error } = await supabase
      .from("quotes")
      .select("id,quote_number,company_name,system_name,items,total,subtotal,discount_total,vat_rate,vat_total,grand_total,created_at,customer_id,note")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const response = NextResponse.json(data ?? []);
    response.headers.set("x-total-count", String(count ?? 0));
    return response;
  } catch {
    return NextResponse.json({ error: "ไม่สามารถดึงประวัติใบเสนอราคาได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getPinSession();
  if (!session.isAuthenticated || !session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const draft = await readDraft(request);
  if ("error" in draft) return NextResponse.json({ error: draft.error }, { status: 400 });

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        company_name: draft.companyName,
        created_by: session.userId,
        customer_id: draft.customerId,
        discount_total: draft.discountTotal,
        grand_total: draft.grandTotal,
        id: crypto.randomUUID(),
        items: draft.items,
        note: draft.note,
        subtotal: draft.subtotal,
        system_name: draft.systemName,
        total: draft.taxableTotal,
        vat_rate: VAT_RATE,
        vat_total: draft.vatTotal,
      })
      .select("id,quote_number,subtotal,discount_total,vat_rate,vat_total,grand_total")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "ไม่สามารถบันทึกใบเสนอราคาได้" }, { status: 500 });
    }

    return NextResponse.json({
      discountTotal: data.discount_total,
      grandTotal: data.grand_total,
      id: data.id,
      quoteNumber: data.quote_number,
      subtotal: data.subtotal,
      vatRate: data.vat_rate,
      vatTotal: data.vat_total,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถบันทึกใบเสนอราคาได้" }, { status: 500 });
  }
}
