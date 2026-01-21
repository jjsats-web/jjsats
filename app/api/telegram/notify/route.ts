import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const PIN_COOKIE = "pin_auth";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

  const text = readString((body as { text?: unknown } | null)?.text);
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const result = await sendTelegramMessage(text);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}