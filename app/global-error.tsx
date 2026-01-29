"use client";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="th">
      <body>
        <main className="container" style={{ textAlign: "center" }}>
          <h1>ระบบขัดข้อง</h1>
          <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
            ขออภัย ระบบมีปัญหาชั่วคราว โปรดลองใหม่อีกครั้ง
          </p>
          {error?.message ? (
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
              {error.message}
            </p>
          ) : null}
          <button type="button" className="ghost" onClick={() => reset()}>
            ลองใหม่
          </button>
        </main>
      </body>
    </html>
  );
}
