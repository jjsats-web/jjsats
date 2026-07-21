import { NextResponse } from "next/server";

import { getPinSession } from "@/lib/auth/pin";
import { formatCurrency } from "@/lib/format";
import { sendTelegramMessage } from "@/lib/telegram";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const APPROVAL_COOLDOWN_MS = 5 * 60 * 1000;

type ApprovalRow = {
  id: string;
  requested_at: string | null;
  status: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/u, "");
}

function isPublicHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    return Boolean(hostname && hostname !== "localhost" && !hostname.endsWith(".local") && !hostname.endsWith(".test"));
  } catch {
    return false;
  }
}

function getApprovalBaseUrl() {
  const configuredUrl = normalizeBaseUrl(process.env.APP_BASE_URL?.trim() ?? "");
  return configuredUrl && isPublicHttpUrl(configuredUrl) ? configuredUrl : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

async function readLatestApproval(quoteId: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("quote_approvals")
    .select("id,status,requested_at")
    .eq("quote_id", quoteId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ApprovalRow | null) ?? null;
}

function remainingCooldownSeconds(requestedAt: string | null) {
  const requestedAtMs = requestedAt ? Date.parse(requestedAt) : Number.NaN;
  if (!Number.isFinite(requestedAtMs)) return 0;
  return Math.max(0, Math.ceil((APPROVAL_COOLDOWN_MS - (Date.now() - requestedAtMs)) / 1000));
}

async function readRequesterName(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("pins").select("first_name,last_name").eq("id", userId).maybeSingle();
  return [readString(data?.first_name), readString(data?.last_name)].filter(Boolean).join(" ");
}

export async function POST(request: Request) {
  const session = await getPinSession();
  if (!session.isAuthenticated || !session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const baseUrl = getApprovalBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า APP_BASE_URL สำหรับลิงก์อนุมัติ" }, { status: 503 });
  }

  let body: { quoteId?: unknown };
  try {
    body = (await request.json()) as { quoteId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const quoteId = readString(body.quoteId);
  if (!quoteId) return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });

  try {
    const supabase = createSupabaseServerClient();
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id,created_by,quote_number,company_name,system_name,grand_total")
      .eq("id", quoteId)
      .maybeSingle();
    if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 500 });
    if (!quote) return NextResponse.json({ error: "ไม่พบใบเสนอราคา" }, { status: 404 });
    if (!session.isAdmin && quote.created_by !== session.userId) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ส่งขออนุมัติใบเสนอราคานี้" }, { status: 403 });
    }

    const latest = await readLatestApproval(quoteId);
    if (latest?.status === "approved") return NextResponse.json({ status: "approved" });
    if (latest?.status === "pending") {
      const retryAfterSeconds = remainingCooldownSeconds(latest.requested_at);
      if (retryAfterSeconds > 0) {
        return NextResponse.json({
          error: `ส่งคำขอแล้ว กรุณารออีก ${retryAfterSeconds} วินาทีก่อนขอใหม่`,
          retryAfterSeconds,
          status: "pending",
        }, { status: 429 });
      }

      const { error: expireError } = await supabase
        .from("quote_approvals")
        .update({ status: "expired" })
        .eq("id", latest.id)
        .eq("status", "pending");
      if (expireError) return NextResponse.json({ error: expireError.message }, { status: 500 });
    }

    const requesterName = await readRequesterName(session.userId);
    const { data: approval, error: approvalError } = await supabase
      .from("quote_approvals")
      .insert({ quote_id: quoteId, requested_by: requesterName || null, status: "pending" })
      .select("id")
      .single();
    if (approvalError || !approval) {
      if (approvalError?.code === "23505") {
        return NextResponse.json({
          error: "มีคำขออนุมัติที่กำลังดำเนินการอยู่",
          retryAfterSeconds: Math.ceil(APPROVAL_COOLDOWN_MS / 1000),
          status: "pending",
        }, { status: 429 });
      }
      return NextResponse.json({ error: approvalError?.message ?? "สร้างคำขออนุมัติไม่สำเร็จ" }, { status: 500 });
    }

    const approvalUrl = `${baseUrl}/approve/${encodeURIComponent(quoteId)}`;
    const companyName = readString(quote.company_name) || "-";
    const systemName = readString(quote.system_name) || "-";
    const quoteNumber = readString(quote.quote_number) || quote.id;
    const total = formatCurrency(readNumber(quote.grand_total));
    const messageLines = [
      "มีใบเสนอราคาขออนุมัติ",
      `เลขที่: ${escapeHtml(quoteNumber)}`,
      `ลูกค้า: ${escapeHtml(companyName)}`,
      `ระบบ: ${escapeHtml(systemName)}`,
      `ยอดสุทธิ: ${escapeHtml(total)}`,
      requesterName ? `ผู้ขอ: ${escapeHtml(requesterName)}` : "",
      `ตรวจสอบและอนุมัติ: <a href="${escapeHtml(approvalUrl)}">เปิดใบเสนอราคา</a>`,
    ].filter(Boolean);
    const telegramResult = await sendTelegramMessage(messageLines.join("\n"), {
      parseMode: "HTML",
      replyMarkup: { inline_keyboard: [[{ text: "เปิดใบเสนอราคา", url: approvalUrl }]] },
    });
    if (!telegramResult.ok) {
      await supabase.from("quote_approvals").delete().eq("id", approval.id);
      return NextResponse.json({ error: telegramResult.error }, { status: 502 });
    }

    const updates: Record<string, number> = {};
    const chatId = Number.parseInt(telegramResult.chatId, 10);
    if (Number.isFinite(chatId)) updates.telegram_chat_id = chatId;
    if (telegramResult.messageId) updates.telegram_message_id = telegramResult.messageId;
    if (Object.keys(updates).length) await supabase.from("quote_approvals").update(updates).eq("id", approval.id);

    return NextResponse.json({ requested: true, status: "pending" });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถส่งคำขออนุมัติได้" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getPinSession();
  if (!session.isAuthenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const quoteIdParam = searchParams.get("quoteId");
  const quoteIds = (idsParam ? idsParam.split(",") : quoteIdParam ? [quoteIdParam] : []).map(readString).filter(Boolean);
  if (!quoteIds.length) return NextResponse.json({ error: "Missing quoteIds" }, { status: 400 });

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("quote_approvals")
      .select("quote_id,status,requested_at")
      .in("quote_id", quoteIds)
      .order("requested_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const statuses: Record<string, { requested_at: string | null; status: string | null }> = {};
    for (const row of data ?? []) {
      if (!row.quote_id || statuses[row.quote_id]) continue;
      statuses[row.quote_id] = { requested_at: row.requested_at, status: row.status };
    }
    return NextResponse.json({ statuses });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถโหลดสถานะการอนุมัติได้" }, { status: 500 });
  }
}
