"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PIN_LENGTH = 6;
const MAX_SIGNATURE_SIZE = 1024 * 1024;

export default function PinRegisterPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const actionStyle = {
    display: "inline-flex",
    justifyContent: "center",
    width: "100%",
  };

  const handleSignatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSignatureData("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพลายเซ็น");
      event.target.value = "";
      setSignatureData("");
      return;
    }

    if (file.size > MAX_SIGNATURE_SIZE) {
      setError("ไฟล์ลายเซ็นต้องไม่เกิน 1MB");
      event.target.value = "";
      setSignatureData("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setSignatureData(result);
    };
    reader.onerror = () => {
      setError("อ่านไฟล์ลายเซ็นไม่สำเร็จ");
      setSignatureData("");
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const nextPin = pin.trim();
    const nextConfirm = confirmPin.trim();
    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    const nextRole = role;
    const nextSignature = signatureData.trim();
    if (!nextFirst || !nextLast) {
      setError("กรุณากรอกชื่อและนามสกุล");
      return;
    }
    if (!nextPin) {
      setError("กรุณากรอก PIN");
      return;
    }
    if (nextPin.length !== PIN_LENGTH) {
      setError(`กรุณากรอก PIN ${PIN_LENGTH} หลัก`);
      return;
    }
    if (nextPin !== nextConfirm) {
      setError("PIN และยืนยัน PIN ไม่ตรงกัน");
      return;
    }
    if (nextRole !== "admin" && nextRole !== "user") {
      setError("กรุณาเลือก Role ให้ถูกต้อง");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/pin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: nextPin,
          firstName: nextFirst,
          lastName: nextLast,
          role: nextRole,
          signatureImage: nextSignature || null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error || "เกิดข้อผิดพลาด");
        return;
      }
      router.push("/pin");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="pin-page">
      <div className="pin-card">
        <h1>ตั้งค่า PIN</h1>
        <p className="pin-hint">ตั้ง PIN ใหม่เพื่อใช้เข้าหน้าทะเบียนลูกค้า</p>
        <form onSubmit={submit} className="pin-form">
          <label htmlFor="firstName">ชื่อ</label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="เช่น สมชาย"
          />
          <label htmlFor="lastName">นามสกุล</label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="เช่น ใจดี"
          />
          <label htmlFor="signatureImage">ลายเซ็น (รูปภาพ)</label>
          <input
            id="signatureImage"
            type="file"
            accept="image/*"
            onChange={handleSignatureChange}
          />
          {signatureData ? (
            <div style={{ marginTop: "-0.4rem", marginBottom: "0.6rem" }}>
              <Image
                src={signatureData}
                width={180}
                height={60}
                unoptimized
                alt="ลายเซ็น"
                style={{
                  maxWidth: "180px",
                  height: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "6px",
                  background: "#fff",
                }}
              />
            </div>
          ) : null}
          <label htmlFor="role">Role</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <label htmlFor="pin">PIN ใหม่</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
            }
            placeholder="เช่น 123456"
            maxLength={PIN_LENGTH}
          />
          <label htmlFor="confirmPin">ยืนยัน PIN</label>
          <input
            id="confirmPin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={confirmPin}
            onChange={(e) =>
              setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
            }
            placeholder="พิมพ์ PIN อีกครั้ง"
            maxLength={PIN_LENGTH}
          />
          {error ? <div className="pin-error">{error}</div> : null}
          <button
            type="submit"
            className="ghost-link"
            style={actionStyle}
            disabled={pending}
          >
            {pending ? "กำลังบันทึก..." : "บันทึก PIN"}
          </button>
          <Link
            href="/pin"
            className="ghost-link"
            style={{ ...actionStyle, marginTop: "0.35rem" }}
          >
            กลับ
          </Link>
        </form>
      </div>
    </main>
  );
}
