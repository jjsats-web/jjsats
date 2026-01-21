"use client";

import { createClient } from "@supabase/supabase-js";

type SupabaseBrowserConfig = {
  url: string;
  anonKey: string;
};

const PLACEHOLDERS = ["YOUR_PROJECT_REF", "YOUR_SUPABASE_ANON_KEY"] as const;

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

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  throw new Error("Base64 decoder not available.");
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

function readSupabaseBrowserConfig(): SupabaseBrowserConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase browser credentials: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  if (containsPlaceholder(url) || containsPlaceholder(anonKey)) {
    throw new Error(
      "Supabase browser credentials still contain placeholders. Update `.env.local` with real values.",
    );
  }

  try {
    new URL(url);
  } catch {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL format. Expected a valid URL like https://xxxx.supabase.co",
    );
  }

  if (!looksLikeJwt(anonKey)) {
    throw new Error(
      "Invalid Supabase anon key format. Expected a JWT (three dot-separated parts). Check NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const expectedRef = new URL(url).hostname.split(".")[0] ?? "";
  const payload = safeParseJwtPayload(anonKey);
  if (!payload) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY. Could not decode JWT payload — make sure you copied the full key without extra characters.",
    );
  }

  const payloadIssuer = typeof payload.iss === "string" ? payload.iss : "";
  if (payloadIssuer && payloadIssuer !== "supabase") {
    throw new Error('Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY. Expected iss="supabase".');
  }

  const payloadRef = typeof payload.ref === "string" ? payload.ref : "";
  if (payloadRef && expectedRef && payloadRef !== expectedRef) {
    throw new Error(
      `Supabase project mismatch: NEXT_PUBLIC_SUPABASE_ANON_KEY ref="${payloadRef}" but NEXT_PUBLIC_SUPABASE_URL ref="${expectedRef}".`,
    );
  }

  return { url, anonKey };
}

let cachedBrowserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (cachedBrowserClient) return cachedBrowserClient;
  const { url, anonKey } = readSupabaseBrowserConfig();
  cachedBrowserClient = createClient(url, anonKey);
  return cachedBrowserClient;
}
