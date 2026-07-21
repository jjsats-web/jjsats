import { NextResponse } from "next/server";

import { clearPinSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/pin", request.url), { status: 303 });
  clearPinSession(response, request);
  return response;
}
