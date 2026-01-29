"use client";

import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const redirectTo = (() => {
    const value = searchParams.get("redirectTo");
    if (!value || !value.startsWith("/") || value.startsWith("/pin")) {
      return "/customer";
    }
    return value;
  })();
  const debugEnabled = searchParams.get("debug") === "1";
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
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

  const logDebug = (message: string) => {
    if (!debugEnabled) return;
    const timestamp = new Date().toISOString().slice(11, 19);
    setDebugLogs((prev) => [...prev.slice(-14), `${timestamp} ${message}`]);
  };

  const submitPin = async (code: string) => {
    if (code.length !== PIN_LENGTH) return;
    logDebug(`submit start len=${code.length}`);
    setPending(true);
    setError("");
    const startedAt = performance.now();
    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      logDebug(`response ${res.status} in ${Math.round(performance.now() - startedAt)}ms`);
      if (!res.ok) {
        logDebug(`error ${payload.error || "invalid pin"}`);
        setStatus("wrong");
        setError(payload.error || "PIN ไม่ถูกต้อง");
        setTimeout(() => {
          setStatus("idle");
          setPin("");
        }, 800);
        return;
      }
      setStatus("correct");
      logDebug(`redirect ${redirectTo}`);
      setTimeout(() => {
        window.location.assign(redirectTo);
      }, 400);
    } catch {
      logDebug("network error");
      setStatus("wrong");
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setTimeout(() => {
        setStatus("idle");
        setPin("");
      }, 800);
    } finally {
      logDebug("submit done");
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
    logDebug("clear");
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
      {debugEnabled ? (
        <div
          style={{
            position: "fixed",
            left: "12px",
            right: "12px",
            bottom: "18px",
            background: "rgba(15, 23, 42, 0.92)",
            color: "#e2e8f0",
            borderRadius: "12px",
            padding: "10px 12px",
            fontSize: "12px",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.3)",
            zIndex: 60,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>PIN Debug</div>
          <div
            style={{
              maxHeight: "160px",
              overflowY: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "11px",
              display: "grid",
              gap: "4px",
            }}
          >
            {debugLogs.length ? (
              debugLogs.map((line, idx) => <div key={`${line}-${idx}`}>{line}</div>)
            ) : (
              <div>no logs</div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
