import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { formatCurrency } from "@/lib/format";
import { sendTelegramMessage } from "@/lib/telegram";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PIN_COOKIE = "pin_auth";
const APPROVAL_COOLDOWN_MS = 10 * 60 * 1000;

type QuoteRow = {
  id: string;
  company_name: string | null;
  system_name: string | null;
  total: number | null;
};

type ApprovalRow = {
  id: string;
  status: string | null;
  requested_at: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function formatQuoteNumber(id: string) {
  const digits = id.replace(/\D/g, "");
  return digits || id;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/u, "");
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function canUseTelegramInlineUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) {
      return false;
    }
    if (isPrivateIpv4(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function parseTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getCooldownRemainingMs(requestedAt: string | null) {
  const timestamp = parseTimestamp(requestedAt);
  if (!timestamp) return 0;
  const elapsed = Date.now() - timestamp;
  return Math.max(0, APPROVAL_COOLDOWN_MS - elapsed);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

async function readRequesterName(pin: string) {
  if (!pin || pin === "ok") return "";
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("pins")
    .select("first_name,last_name")
    .eq("pin", pin)
    .limit(1)
    .maybeSingle();

  const firstName = readString(data?.first_name);
  const lastName = readString(data?.last_name);
  return [firstName, lastName].filter(Boolean).join(" ").trim();
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

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(PIN_COOKIE)?.value ?? "";
  if (!pinCookie || pinCookie === "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const quoteId = readString((body as { quoteId?: unknown } | null)?.quoteId);
  if (!quoteId) {
    return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id,company_name,system_name,total")
      .eq("id", quoteId)
      .limit(1)
      .maybeSingle();

    if (quoteError) {
      return NextResponse.json({ error: quoteError.message }, { status: 500 });
    }

    if (!quote) {
      return NextResponse.json({ error: "ไม่พบใบเสนอราคา" }, { status: 404 });
    }

    const latest = await readLatestApproval(quoteId);
    const latestStatus = readString(latest?.status);
    if (latestStatus === "approved") {
      return NextResponse.json({ status: "approved" });
    }

    if (latestStatus === "pending") {
      const remainingMs = getCooldownRemainingMs(latest?.requested_at ?? null);
      if (remainingMs > 0) {
        return NextResponse.json({
          status: "pending",
          requested: false,
          retryAfterSeconds: Math.ceil(remainingMs / 1000),
        });
      }
    }

    const requesterName = await readRequesterName(pinCookie);
    const requesterLabel = requesterName || (pinCookie ? `PIN ${pinCookie}` : "");
    const { data: approval, error: approvalError } = await supabase
      .from("quote_approvals")
      .insert({
        quote_id: quoteId,
        status: "pending",
        requested_by: requesterLabel || null,
      })
      .select("id")
      .single();

    if (approvalError || !approval) {
      return NextResponse.json(
        { error: approvalError?.message ?? "สร้างคำขออนุมัติไม่สำเร็จ" },
        { status: 500 },
      );
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const baseUrl = normalizeBaseUrl(process.env.APP_BASE_URL?.trim() || origin);
    const approvalUrl = `${baseUrl}/approve/${encodeURIComponent(quoteId)}`;

    const quoteRow = quote as QuoteRow;
    const quoteRef = formatQuoteNumber(quoteRow.id);
    const companyName = readString(quoteRow.company_name) || "-";
    const systemName = readString(quoteRow.system_name) || "-";
    const total = formatCurrency(readNumber(quoteRow.total));
    const safeQuoteRef = escapeHtml(quoteRef);
    const safeCompanyName = escapeHtml(companyName);
    const safeSystemName = escapeHtml(systemName);
    const safeTotal = escapeHtml(total);
    const safeRequesterLabel = escapeHtml(requesterLabel);
    const safeApprovalUrl = escapeHtml(approvalUrl);
    const useInlineButton = canUseTelegramInlineUrl(approvalUrl);

    const messageLines = [
      "มีใบเสนอราคาขออนุมัติ",
      `เลขที่: ${safeQuoteRef}`,
      `ลูกค้า: ${safeCompanyName}`,
      `ระบบ: ${safeSystemName}`,
      `ยอดรวม: ${safeTotal}`,
      requesterLabel ? `ผู้ขอ: ${safeRequesterLabel}` : "",
      useInlineButton
        ? `ตรวจสอบและอนุมัติ: <a href="${safeApprovalUrl}">เปิดใบเสนอราคา</a>`
        : `ตรวจสอบและอนุมัติ: ${safeApprovalUrl}`,
    ].filter(Boolean);

    const telegramResult = await sendTelegramMessage(messageLines.join("\n"), {
      parseMode: "HTML",
      replyMarkup: useInlineButton
        ? { inline_keyboard: [[{ text: "เปิดใบเสนอราคา", url: approvalUrl }]] }
        : undefined,
    });
    if (!telegramResult.ok) {
      await supabase.from("quote_approvals").delete().eq("id", approval.id);
      return NextResponse.json({ error: telegramResult.error }, { status: 502 });
    }

    const updates: Record<string, unknown> = {};
    const chatIdValue = Number.parseInt(telegramResult.chatId, 10);
    if (Number.isFinite(chatIdValue)) {
      updates.telegram_chat_id = chatIdValue;
    }
    if (telegramResult.messageId) {
      updates.telegram_message_id = telegramResult.messageId;
    }

    if (Object.keys(updates).length) {
      await supabase.from("quote_approvals").update(updates).eq("id", approval.id);
    }

    return NextResponse.json({ status: "pending", requested: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการส่งคำขออนุมัติ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(PIN_COOKIE)?.value ?? "";
  if (!pinCookie || pinCookie === "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const quoteIdParam = searchParams.get("quoteId");
  const rawIds = idsParam ? idsParam.split(",") : quoteIdParam ? [quoteIdParam] : [];
  const quoteIds = rawIds.map(readString).filter(Boolean);

  if (!quoteIds.length) {
    return NextResponse.json({ error: "Missing quoteIds" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("quote_approvals")
      .select("quote_id,status,requested_at")
      .in("quote_id", quoteIds)
      .order("requested_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const latestById: Record<
      string,
      { status: string | null; requested_at: string | null }
    > = {};
    for (const row of data ?? []) {
      const record = row as {
        quote_id?: unknown;
        status?: unknown;
        requested_at?: unknown;
      };
      const quoteId = readString(record.quote_id);
      if (!quoteId || latestById[quoteId]) continue;
      latestById[quoteId] = {
        status: typeof record.status === "string" ? record.status : null,
        requested_at: typeof record.requested_at === "string" ? record.requested_at : null,
      };
    }

    return NextResponse.json({ statuses: latestById });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch approvals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
