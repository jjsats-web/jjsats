import { NextResponse } from "next/server";

import { getPinSession, type PinSession } from "@/lib/auth/pin";
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
      return {
        description: readString(record.description),
        discount,
        lineTotal: roundMoney(qty * price * (1 - discount / 100)),
        price,
        qty,
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
    systemName: readString(raw.systemName) || companyName,
    taxableTotal,
    vatTotal,
  };
}

async function canChangeQuote(id: string, session: PinSession) {
  const supabase = createSupabaseServerClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id,created_by")
    .eq("id", id)
    .maybeSingle();
  if (quoteError) return { error: NextResponse.json({ error: quoteError.message }, { status: 500 }), supabase };
  if (!quote) return { error: NextResponse.json({ error: "ไม่พบใบเสนอราคา" }, { status: 404 }), supabase };
  if (!session.isAdmin && quote.created_by !== session.userId) {
    return { error: NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขใบเสนอราคานี้" }, { status: 403 }), supabase };
  }

  const { data: approval, error: approvalError } = await supabase
    .from("quote_approvals")
    .select("status")
    .eq("quote_id", id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (approvalError) return { error: NextResponse.json({ error: approvalError.message }, { status: 500 }), supabase };
  if (approval?.status === "pending" || approval?.status === "approved") {
    return { error: NextResponse.json({ error: "ไม่สามารถแก้ไขหรือลบใบเสนอราคาที่อยู่ระหว่างหรือผ่านการอนุมัติแล้ว" }, { status: 409 }), supabase };
  }
  return { error: null, supabase };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPinSession();
  if (!session.isAuthenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing quote id" }, { status: 400 });

  const draft = await readDraft(request);
  if ("error" in draft) return NextResponse.json({ error: draft.error }, { status: 400 });
  const access = await canChangeQuote(id, session);
  if (access.error) return access.error;

  const { data, error } = await access.supabase
    .from("quotes")
    .update({
      company_name: draft.companyName,
      customer_id: draft.customerId,
      discount_total: draft.discountTotal,
      grand_total: draft.grandTotal,
      items: draft.items,
      note: draft.note,
      subtotal: draft.subtotal,
      system_name: draft.systemName,
      total: draft.taxableTotal,
      vat_rate: VAT_RATE,
      vat_total: draft.vatTotal,
    })
    .eq("id", id)
    .select("id,quote_number,grand_total")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "ไม่สามารถแก้ไขใบเสนอราคาได้" }, { status: 500 });
  return NextResponse.json({ id: data.id, quoteNumber: data.quote_number, grandTotal: data.grand_total });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPinSession();
  if (!session.isAuthenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing quote id" }, { status: 400 });

  const access = await canChangeQuote(id, session);
  if (access.error) return access.error;

  const { error: approvalError } = await access.supabase.from("quote_approvals").delete().eq("quote_id", id);
  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 });
  const { error } = await access.supabase.from("quotes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}
