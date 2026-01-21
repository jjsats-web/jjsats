import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  companyName: string;
  taxId: string;
  contactName: string;
  contactPhone: string;
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
  address: string | null;
  approx_purchase_date: string | null;
  created_at?: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTaxId(value: string) {
  return value.replace(/\D/g, "");
}

function buildDraft(body: unknown): CustomerDraft {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    companyName: readString(raw.companyName),
    taxId: normalizeTaxId(readString(raw.taxId)),
    contactName: readString(raw.contactName),
    contactPhone: readString(raw.contactPhone),
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
    address: row.address ?? "",
    approxPurchaseDate: row.approx_purchase_date ?? "",
    createdAt: row.created_at ?? "",
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id,company_name,tax_id,contact_name,contact_phone,address,approx_purchase_date,created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data ?? []).map((row) => toCustomer(row as CustomerRow)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        id: crypto.randomUUID(),
        company_name: draft.companyName,
        tax_id: draft.taxId,
        contact_name: draft.contactName,
        contact_phone: draft.contactPhone,
        address: draft.address,
        approx_purchase_date: draft.approxPurchaseDate,
      })
      .select(
        "id,company_name,tax_id,contact_name,contact_phone,address,approx_purchase_date,created_at",
      )
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "เกิดข้อผิดพลาด" }, { status: 500 });
    }

    return NextResponse.json(toCustomer(data as CustomerRow), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
