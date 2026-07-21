import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/pin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PinRow = {
  created_at: string | null;
  first_name: string | null;
  id: string;
  last_name: string | null;
  signature_image: string | null;
};

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pins")
      .select("id,first_name,last_name,signature_image,created_at")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json((data ?? []).map((row) => {
      const record = row as PinRow;
      return {
        createdAt: record.created_at ?? "",
        firstName: record.first_name ?? "",
        id: record.id,
        lastName: record.last_name ?? "",
        signatureImage: record.signature_image ?? "",
      };
    }));
  } catch {
    return NextResponse.json({ error: "ไม่สามารถโหลดรายการ PIN ได้" }, { status: 500 });
  }
}
