import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function requestAttemptKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  // The proxy must overwrite these headers; the PIN itself is never part of the key.
  return `ip:${forwarded || realIp || "unknown"}`;
}

export async function pinLoginRetryAfter(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("pin_login_retry_after", {
    input_attempt_key: requestAttemptKey(request),
  });
  if (error) throw new Error(error.message);
  return Math.max(0, Number(data ?? 0));
}

export async function recordPinLoginFailure(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("record_pin_login_failure", {
    input_attempt_key: requestAttemptKey(request),
  });
  if (error) throw new Error(error.message);
  return Math.max(0, Number(data ?? 0));
}

export async function clearPinLoginFailures(request: Request) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("clear_pin_login_failures", {
    input_attempt_key: requestAttemptKey(request),
  });
  if (error) throw new Error(error.message);
}
