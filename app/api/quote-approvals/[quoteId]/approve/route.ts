import { NextResponse } from "next/server";

import { getPinSession } from "@/lib/auth/pin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(_request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const session = await getPinSession();
  if (!session.isAuthenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin || !session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { quoteId } = await params;
  if (!quoteId) return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });

  try {
    const supabase = createSupabaseServerClient();
    const [{ data: approval, error: approvalError }, { data: profile }] = await Promise.all([
      supabase
        .from("quote_approvals")
        .select("id,status")
        .eq("quote_id", quoteId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("pins").select("first_name,last_name").eq("id", session.userId).maybeSingle(),
    ]);
    if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 });
    if (!approval) return NextResponse.json({ error: "ไม่พบคำขออนุมัติ" }, { status: 404 });
    if (approval.status === "approved") return NextResponse.json({ status: "approved" });
    if (approval.status !== "pending") return NextResponse.json({ error: "คำขออนุมัตินี้หมดอายุแล้ว" }, { status: 409 });

    const approverName = [readString(profile?.first_name), readString(profile?.last_name)].filter(Boolean).join(" ") || null;
    const { data: updated, error: updateError } = await supabase
      .from("quote_approvals")
      .update({ approved_at: new Date().toISOString(), approved_by: approverName, status: "approved" })
      .eq("id", approval.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "สถานะคำขอถูกเปลี่ยนแล้ว กรุณารีเฟรชหน้า" }, { status: 409 });
    return NextResponse.json({ status: "approved" });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถอนุมัติใบเสนอราคาได้" }, { status: 500 });
  }
}
