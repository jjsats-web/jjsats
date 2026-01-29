import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PIN_COOKIE = "pin_auth";
const ROLE_COOKIE = "pin_role";
const ADMIN_ROLE = "admin";
const MASTER_PIN = "000000";

export type PinSession = {
  pin: string;
  role: "admin" | "user";
  isAuthenticated: boolean;
  isAdmin: boolean;
};

export async function getPinSession(): Promise<PinSession> {
  const cookieStore = await cookies();
  const pin = cookieStore.get(PIN_COOKIE)?.value ?? "";
  const roleCookie = cookieStore.get(ROLE_COOKIE)?.value ?? "";
  const role = roleCookie === ADMIN_ROLE ? "admin" : "user";
  const isAuthenticated = Boolean(pin && pin !== "ok");
  const isAdmin = role === "admin" || pin === MASTER_PIN;

  return {
    pin,
    role,
    isAuthenticated,
    isAdmin,
  };
}

export async function requirePin() {
  const session = await getPinSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function requireAdmin() {
  const session = await getPinSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
