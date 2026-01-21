import "server-only";

import { createClient } from "@supabase/supabase-js";

type SupabaseConfig = {
  url: string;
  key: string;
};

const PLACEHOLDERS = [
  "YOUR_PROJECT_REF",
  "YOUR_SUPABASE_SERVICE_ROLE_KEY",
  "YOUR_SUPABASE_ANON_KEY",
] as const;

function containsPlaceholder(value: string) {
  return PLACEHOLDERS.some((placeholder) => value.includes(placeholder));
}

function looksLikeJwt(token: string) {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

  if (typeof atob === "function") {
    return atob(padded);
  }

  return Buffer.from(padded, "base64").toString("utf8");
}

function safeParseJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payloadText = decodeBase64Url(parts[1] ?? "");
    const payload = JSON.parse(payloadText) as Record<string, unknown>;
    return payload;
  } catch {
    return null;
  }
}

function readSupabaseConfig(): SupabaseConfig {
  const urlSource = process.env.SUPABASE_URL ? "SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_URL";
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();

  const keySource = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "SUPABASE_SERVICE_ROLE_KEY"
    : process.env.SUPABASE_ANON_KEY
      ? "SUPABASE_ANON_KEY"
      : "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  const key = (process.env[keySource] ?? "").trim();

  if (!url || !key) {
    throw new Error(
      "Missing Supabase credentials: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).",
    );
  }

  if (containsPlaceholder(url)) {
    throw new Error(`${urlSource} still contains placeholder text. Update \`.env.local\` with real values.`);
  }

  if (containsPlaceholder(key)) {
    throw new Error(`${keySource} still contains placeholder text. Update \`.env.local\` with real values.`);
  }

  try {
    new URL(url);
  } catch {
    throw new Error("Invalid SUPABASE_URL format. Expected a valid URL like https://xxxx.supabase.co");
  }

  if (!looksLikeJwt(key)) {
    throw new Error(
      "Invalid Supabase key format. Expected a JWT (three dot-separated parts). Check SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY.",
    );
  }

  const expectedRef = new URL(url).hostname.split(".")[0] ?? "";
  const payload = safeParseJwtPayload(key);
  if (!payload) {
    throw new Error(
      `Invalid ${keySource}. Could not decode JWT payload — make sure you copied the full key without extra characters.`,
    );
  }

  const payloadIssuer = typeof payload.iss === "string" ? payload.iss : "";
  if (payloadIssuer && payloadIssuer !== "supabase") {
    throw new Error(`Invalid ${keySource}. Expected iss="supabase".`);
  }

  const payloadRef = typeof payload.ref === "string" ? payload.ref : "";
  if (payloadRef && expectedRef && payloadRef !== expectedRef) {
    throw new Error(
      `Supabase project mismatch: ${keySource} ref="${payloadRef}" but ${urlSource} ref="${expectedRef}".`,
    );
  }

  const payloadRole = typeof payload.role === "string" ? payload.role : "";
  if (keySource === "SUPABASE_SERVICE_ROLE_KEY" && payloadRole && payloadRole !== "service_role") {
    throw new Error(`Invalid SUPABASE_SERVICE_ROLE_KEY. Expected role="service_role".`);
  }

  return { url, key };
}

export function createSupabaseServerClient() {
  const { url, key } = readSupabaseConfig();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
