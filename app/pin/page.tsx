"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type PinStatus = "idle" | "correct" | "wrong";
const PIN_LENGTH = 6;

export default function PinPage() {
  return (
    <Suspense fallback={null}>
      <PinPageClient />
    </Suspense>
  );
}

function PinPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/customer";
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<PinStatus>("idle");

  useEffect(() => {
    if (pin.length === PIN_LENGTH && !pending) {
      void submitPin(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const submitPin = async (code: string) => {
    if (code.length !== PIN_LENGTH) return;
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("wrong");
        setError(payload.error || "PIN ไม่ถูกต้อง");
        setTimeout(() => {
          setStatus("idle");
          setPin("");
        }, 800);
        return;
      }
      setStatus("correct");
      setTimeout(() => {
        router.replace(redirectTo);
      }, 400);
    } catch {
      setStatus("wrong");
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setTimeout(() => {
        setStatus("idle");
        setPin("");
      }, 800);
    } finally {
      setPending(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (pending || status === "correct") return;
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      return prev + digit;
    });
  };

  const handleClear = () => {
    if (pending) return;
    setStatus("idle");
    setPin("");
    setError("");
  };

  const dots = Array.from({ length: PIN_LENGTH });
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  return (
    <main className={`pin-page ${status !== "idle" ? `pin-${status}` : ""}`}>
      <div className="pin-card">
        <h1>กรอกรหัส PIN</h1>
        <p className="pin-hint">กรุณากรอกรหัส PIN เพื่อเข้าหน้าทะเบียนลูกค้า</p>

        <div className="pin-dots">
          {dots.map((_, idx) => (
            <span
              key={idx}
              className={`dot ${pin.length > idx ? "active" : ""} ${
                status === "wrong" ? "wrong" : status === "correct" ? "correct" : ""
              }`}
            />
          ))}
        </div>

        {error ? <div className="pin-error" style={{ textAlign: "center" }}>{error}</div> : null}

        <div className="pin-pad">
          {digits.map((d, idx) => (
          <button
            key={d + idx}
            type="button"
            className="number"
            onClick={() => handleDigit(d)}
            disabled={pending}
          >
            {d}
          </button>
          ))}
          <button type="button" className="number number-clear" onClick={handleClear} disabled={pending}>
            ล้าง
          </button>
        </div>

      </div>
    </main>
  );
}
