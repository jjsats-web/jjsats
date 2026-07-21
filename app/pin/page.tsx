"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import Icon from "@/components/Icon";
import "./pin.css";

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
    if (!value || value === "/" || !value.startsWith("/") || value.startsWith("/pin")) {
      return "/quotation";
    }
    return value;
  })();
  const debugEnabled = searchParams.get("debug") === "1";
  const errorFromQuery = searchParams.get("error") ?? "";

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(errorFromQuery);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<PinStatus>("idle");
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const root = document.querySelector(".pin-page");
    const lockTargets = [document.documentElement, document.body];
    const preventDefault = (event: Event) => event.preventDefault();
    const preventPinTouchMove = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest(".pin-page")) {
        event.preventDefault();
      }
    };

    lockTargets.forEach((target) => target.classList.add("pin-screen-lock"));
    root?.addEventListener("contextmenu", preventDefault);
    root?.addEventListener("selectstart", preventDefault);
    root?.addEventListener("dragstart", preventDefault);
    document.addEventListener("touchmove", preventPinTouchMove, { passive: false });

    return () => {
      lockTargets.forEach((target) => target.classList.remove("pin-screen-lock"));
      root?.removeEventListener("contextmenu", preventDefault);
      root?.removeEventListener("selectstart", preventDefault);
      root?.removeEventListener("dragstart", preventDefault);
      document.removeEventListener("touchmove", preventPinTouchMove);
    };
  }, []);

  useEffect(() => {
    setError(errorFromQuery);
    setPending(false);
    if (!errorFromQuery) return;
    setStatus("wrong");
    setPin("");
    const timeout = window.setTimeout(() => setStatus("idle"), 800);
    return () => window.clearTimeout(timeout);
  }, [errorFromQuery]);

  useEffect(() => {
    if (pin.length === PIN_LENGTH && !pending) {
      submitPin(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const logDebug = (message: string) => {
    if (!debugEnabled) return;
    const timestamp = new Date().toISOString().slice(11, 19);
    setDebugLogs((prev) => [...prev.slice(-14), `${timestamp} ${message}`]);
  };

  const submitPin = (code: string) => {
    if (code.length !== PIN_LENGTH) return;

    logDebug(`submit start len=${code.length} via requestSubmit`);
    setPending(true);
    setError("");
    setStatus("correct");
    logDebug(`redirect ${redirectTo}`);
    formRef.current?.requestSubmit();
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

  const handleDelete = () => {
    if (pending) return;
    setStatus("idle");
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const dots = Array.from({ length: PIN_LENGTH });
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const filledCount = `${pin.length}/${PIN_LENGTH}`;

  return (
    <main className={`pin-page pin-stitch-page ${status !== "idle" ? `pin-${status}` : ""}`}>
      <div className="pin-page__ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <form ref={formRef} method="POST" action="/pin/login" style={{ display: "contents" }}>
        <input type="hidden" name="pin" value={pin} readOnly />
        <input type="hidden" name="redirectTo" value={redirectTo} readOnly />
        {debugEnabled ? <input type="hidden" name="debug" value="1" readOnly /> : null}
      </form>
      <div className="pin-card">
        <div className="pin-card__top">
          <span className="pin-card__icon">
            <Icon name="description" />
          </span>
          <span className="pin-card__status">{pending ? "กำลังตรวจสอบ" : filledCount}</span>
        </div>

        <div className="pin-card__copy">
          <p className="pin-card__eyebrow">JJSAT Quotation</p>
          <h1>กรอกรหัส PIN</h1>
          <p className="pin-hint">เข้าสู่ระบบเพื่อจัดการใบเสนอราคาและข้อมูลลูกค้า</p>
        </div>

        <div className="pin-dots" aria-label={`กรอก PIN แล้ว ${filledCount} หลัก`}>
          {dots.map((_, idx) => (
            <span
              key={idx}
              className={`dot ${pin.length > idx ? "active" : ""} ${
                status === "wrong" ? "wrong" : status === "correct" ? "correct" : ""
              }`}
            />
          ))}
        </div>

        <div className="pin-message" aria-live="polite">
          {error ? (
            <div className="pin-error">{error}</div>
          ) : pending ? (
            <div className="pin-loader" aria-label="กำลังเข้าสู่ระบบ" />
          ) : (
            " "
          )}
        </div>

        <div className="pin-pad">
          {digits.map((digit, idx) => (
            <button
              key={`${digit}-${idx}`}
              type="button"
              className="number"
              onClick={() => handleDigit(digit)}
              disabled={pending}
              aria-label={`เลข ${digit}`}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="number number-zero"
            onClick={() => handleDigit("0")}
            disabled={pending}
            aria-label="เลข 0"
          >
            0
          </button>
          <button
            type="button"
            className="number number-delete"
            onClick={handleDelete}
            disabled={pending}
          >
            ล้าง
          </button>
        </div>

        <button type="button" className="pin-clear-button" onClick={handleClear} disabled={pending}>
          ล้างทั้งหมด
        </button>
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
