import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";

function maskPin(pin: string) {
  if (!pin) return "";
  if (pin.length <= 2) return "*".repeat(pin.length);
  return `${pin.slice(0, 1)}${"*".repeat(Math.max(pin.length - 2, 0))}${pin.slice(-1)}`;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const pin = cookieStore.get(PIN_COOKIE)?.value ?? "";
  const role = cookieStore.get(ROLE_COOKIE)?.value ?? "";

  const response = NextResponse.json({
    pinCookiePresent: Boolean(pin),
    pinCookieMasked: maskPin(pin),
    roleCookiePresent: Boolean(role),
    roleCookieValue: role || "",
    cookieNames: cookieStore.getAll().map((cookie) => cookie.name),
  });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  return response;
}
