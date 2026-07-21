import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { PIN_SESSION_COOKIE, type PinRole, verifyPinSessionToken } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PinSession = {
  isAdmin: boolean;
  isAuthenticated: boolean;
  role: PinRole;
  userId: string | null;
};

const anonymousSession: PinSession = {
  isAdmin: false,
  isAuthenticated: false,
  role: "user",
  userId: null,
};

export async function getPinSession(): Promise<PinSession> {
  const cookieStore = await cookies();
  const verified = await verifyPinSessionToken(cookieStore.get(PIN_SESSION_COOKIE)?.value);
  if (!verified) return anonymousSession;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pins")
      .select("id,role")
      .eq("id", verified.sub)
      .maybeSingle();

    if (error || !data) return anonymousSession;
    const role: PinRole = data.role === "admin" ? "admin" : "user";
    return {
      isAdmin: role === "admin",
      isAuthenticated: true,
      role,
      userId: data.id,
    };
  } catch {
    return anonymousSession;
  }
}

export async function requirePin() {
  const session = await getPinSession();
  if (session.isAuthenticated) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireAdmin() {
  const session = await getPinSession();
  if (session.isAdmin) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
