"use client";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return (
    <main className="container" style={{ textAlign: "center" }}>
      <h1>เกิดข้อผิดพลาด</h1>
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
  );
}
