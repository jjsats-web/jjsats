import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  dealerPrice: number;
  projectPrice: number;
  userPrice: number;
  description: string;
};

type ProductDraft = Omit<Product, "id">;

type ProductRow = {
  id: string;
  name: string | null;
  sku: string | null;
  unit: string | null;
  dealer_price: number | string | null;
  project_price: number | string | null;
  user_price: number | string | null;
  description: string | null;
  created_at?: string | null;
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name ?? "",
    sku: row.sku ?? "",
    unit: row.unit ?? "",
    dealerPrice: Number(row.dealer_price ?? 0),
    projectPrice: Number(row.project_price ?? 0),
    userPrice: Number(row.user_price ?? 0),
    description: row.description ?? "",
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function buildDraft(body: unknown): ProductDraft {
  const raw = (body ?? {}) as Record<string, unknown>;
  const legacyUnitPrice = readNumber(raw.unitPrice);
  return {
    name: readString(raw.name),
    sku: readString(raw.sku),
    unit: readString(raw.unit),
    dealerPrice: readNumber(raw.dealerPrice ?? legacyUnitPrice),
    projectPrice: readNumber(raw.projectPrice ?? legacyUnitPrice),
    userPrice: readNumber(raw.userPrice ?? legacyUnitPrice),
    description: readString(raw.description),
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,unit,dealer_price,project_price,user_price,description,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json((data ?? []).map((row) => toProduct(row as ProductRow)));
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
  if (!draft.name) {
    return NextResponse.json({ error: "กรุณาระบุชื่อสินค้า" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .insert({
        id: crypto.randomUUID(),
        name: draft.name,
        sku: draft.sku,
        unit: draft.unit,
        dealer_price: draft.dealerPrice,
        project_price: draft.projectPrice,
        user_price: draft.userPrice,
        description: draft.description,
      })
      .select("id,name,sku,unit,dealer_price,project_price,user_price,description")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "เกิดข้อผิดพลาด" }, { status: 500 });
    }

    return NextResponse.json(toProduct(data as ProductRow), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
