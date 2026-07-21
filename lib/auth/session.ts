export const PIN_SESSION_COOKIE = "pin_session";
export const LEGACY_PIN_COOKIE = "pin_auth";
export const LEGACY_ROLE_COOKIE = "pin_role";

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

export type PinRole = "admin" | "user";

type PinSessionPayload = {
  exp: number;
  iat: number;
  role: PinRole;
  sub: string;
  v: 1;
};

export type VerifiedPinSession = Pick<PinSessionPayload, "role" | "sub">;

function getSessionSecret() {
  // A dedicated secret is preferred; the server-only Supabase key keeps existing deployments working.
  const secret = (process.env.PIN_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!secret) {
    throw new Error("Missing PIN_SESSION_SECRET. Set a long random value before enabling PIN sessions.");
  }
  return secret;
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string) {
  const signature = await crypto.subtle.sign("HMAC", await getSigningKey(), encoder.encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function isPayload(value: unknown): value is PinSessionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.v === 1 &&
    typeof payload.sub === "string" &&
    Boolean(payload.sub) &&
    (payload.role === "admin" || payload.role === "user") &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number"
  );
}

export async function createPinSessionToken({
  role,
  userId,
}: {
  role: PinRole;
  userId: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: PinSessionPayload = {
    exp: now + SESSION_TTL_SECONDS,
    iat: now,
    role,
    sub: userId,
    v: 1,
  };
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await sign(encodedPayload)}`;
}

export async function verifyPinSessionToken(token: string | undefined | null): Promise<VerifiedPinSession | null> {
  if (!token) return null;
  const [encodedPayload, signature, ...extra] = token.split(".");
  if (!encodedPayload || !signature || extra.length) return null;

  try {
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await getSigningKey(),
      decodeBase64Url(signature),
      encoder.encode(encodedPayload),
    );
    if (!validSignature) return null;

    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as unknown;
    if (!isPayload(payload) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { role: payload.role, sub: payload.sub };
  } catch {
    return null;
  }
}

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function pinSessionCookieOptions(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const secure = (url.protocol === "https:" || forwardedProto === "https") && !isLocalhost(url.hostname);
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}

type CookieResponse = {
  cookies: {
    set: (name: string, value: string, options: Record<string, unknown>) => void;
  };
};

export async function setPinSession(
  response: CookieResponse,
  request: Request,
  session: { role: PinRole; userId: string },
) {
  const options = pinSessionCookieOptions(request);
  response.cookies.set(PIN_SESSION_COOKIE, await createPinSessionToken(session), options);
  clearLegacyPinCookies(response, request);
}

export function clearLegacyPinCookies(response: CookieResponse, request: Request) {
  const options = { ...pinSessionCookieOptions(request), maxAge: 0 };
  response.cookies.set(LEGACY_PIN_COOKIE, "", options);
  response.cookies.set(LEGACY_ROLE_COOKIE, "", options);
}

export function clearPinSession(response: CookieResponse, request: Request) {
  const options = { ...pinSessionCookieOptions(request), maxAge: 0 };
  response.cookies.set(PIN_SESSION_COOKIE, "", options);
  clearLegacyPinCookies(response, request);
}
