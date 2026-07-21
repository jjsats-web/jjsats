import { webcrypto } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPinSessionToken, verifyPinSessionToken } from "@/lib/auth/session";

const originalSecret = process.env.PIN_SESSION_SECRET;

beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  process.env.PIN_SESSION_SECRET = "test-session-secret-that-is-long-enough";
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.PIN_SESSION_SECRET;
  } else {
    process.env.PIN_SESSION_SECRET = originalSecret;
  }
});

describe("PIN session tokens", () => {
  it("verifies a signed session without storing the PIN", async () => {
    const token = await createPinSessionToken({ role: "admin", userId: "user-123" });

    expect(token).not.toContain("000000");
    await expect(verifyPinSessionToken(token)).resolves.toEqual({ role: "admin", sub: "user-123" });
  });

  it("rejects a modified token", async () => {
    const token = await createPinSessionToken({ role: "user", userId: "user-456" });
    const modifiedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(verifyPinSessionToken(modifiedToken)).resolves.toBeNull();
  });
});
