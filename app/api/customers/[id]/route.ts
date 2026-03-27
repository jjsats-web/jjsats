import { NextResponse } from "next/server";

import { requirePin } from "@/lib/auth/pin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  companyName: string;
  taxId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  approxPurchaseDate: string;
  createdAt: string;
};

type CustomerDraft = Omit<Customer, "id" | "createdAt">;

type CustomerRow = {
  id: string;
  company_name: string | null;
  tax_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email?: string | null;
  address: string | null;
  approx_purchase_date: string | null;
  created_at?: string | null;
};

type SupabaseErrorLike = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const CUSTOMER_SELECT =
  "id,company_name,tax_id,contact_name,contact_phone,contact_email,address,approx_purchase_date,created_at";
const CUSTOMER_SELECT_LEGACY =
  "id,company_name,tax_id,contact_name,contact_phone,address,approx_purchase_date,created_at";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTaxId(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildDraft(body: unknown): CustomerDraft {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    companyName: readString(raw.companyName),
    taxId: normalizeTaxId(readString(raw.taxId)),
    contactName: readString(raw.contactName),
    contactPhone: readString(raw.contactPhone),
    contactEmail: normalizeEmail(readString(raw.contactEmail)),
    address: readString(raw.address),
    approxPurchaseDate: readString(raw.approxPurchaseDate),
  };
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    companyName: row.company_name ?? "",
    taxId: row.tax_id ?? "",
    contactName: row.contact_name ?? "",
    contactPhone: row.contact_phone ?? "",
    contactEmail: row.contact_email ?? "",
    address: row.address ?? "",
    approxPurchaseDate: row.approx_purchase_date ?? "",
    createdAt: row.created_at ?? "",
  };
}

function isMissingContactEmailColumn(error: SupabaseErrorLike | null | undefined) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return message.includes("contact_email") && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requirePin();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    const supabase = createSupabaseServerClient();
    const response = await supabase
      .from("customers")
      .select(CUSTOMER_SELECT)
      .eq("id", id)
      .maybeSingle();
    let data = response.data as CustomerRow | null;
    let error = response.error;

    if (error && isMissingContactEmailColumn(error)) {
      const legacyResponse = await supabase
        .from("customers")
        .select(CUSTOMER_SELECT_LEGACY)
        .eq("id", id)
        .maybeSingle();
      data = (legacyResponse.data ?? null) as CustomerRow | null;
      error = legacyResponse.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
    }

    return NextResponse.json(toCustomer(data as CustomerRow));
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requirePin();
  if (authError) return authError;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const draft = buildDraft(body);
  if (!draft.companyName) {
    return NextResponse.json({ error: "กรุณาระบุ “ชื่อบริษัท”" }, { status: 400 });
  }

  if (draft.taxId && draft.taxId.length !== 13) {
    return NextResponse.json(
      { error: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก" },
      { status: 400 },
    );
  }

  if (draft.contactEmail && !isValidEmail(draft.contactEmail)) {
    return NextResponse.json({ error: "Invalid E-mail format" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const updatePayload = {
      company_name: draft.companyName,
      tax_id: draft.taxId,
      contact_name: draft.contactName,
      contact_phone: draft.contactPhone,
      contact_email: draft.contactEmail,
      address: draft.address,
      approx_purchase_date: draft.approxPurchaseDate,
    };
    const response = await supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", id)
      .select(CUSTOMER_SELECT)
      .maybeSingle();
    let data = response.data as CustomerRow | null;
    let error = response.error;

    if (error && isMissingContactEmailColumn(error)) {
      const { contact_email: _contactEmail, ...legacyUpdatePayload } = updatePayload;
      const legacyResponse = await supabase
        .from("customers")
        .update(legacyUpdatePayload)
        .eq("id", id)
        .select(CUSTOMER_SELECT_LEGACY)
        .maybeSingle();
      data = (legacyResponse.data ?? null) as CustomerRow | null;
      error = legacyResponse.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
    }

    return NextResponse.json(toCustomer(data as CustomerRow));
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
