"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { usePinRole } from "@/components/PinRoleProvider";

const PIN_LENGTH = 6;
const MAX_SIGNATURE_SIZE = 1024 * 1024;
type MenuItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  prefetch?: boolean;
};

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
  const { role: navRole, setRole: setNavRole } = usePinRole();
  const activeHref = "/pin/register";
  const menuItems: MenuItem[] = [
    { id: "quote", href: "/", label: "ใบเสนอราคา", icon: "description" },
    { id: "customer", href: "/customer", label: "ทะเบียนลูกค้า", icon: "group" },
    {
      id: "product",
      href: "/product",
      label: "สินค้าบริษัท",
      icon: "inventory_2",
      adminOnly: true,
    },
    {
      id: "register",
      href: "/pin/register",
      label: "ลงทะเบียน",
      icon: "app_registration",
      adminOnly: true,
    },
    {
      id: "manage",
      href: "/pin/manage",
      label: "จัดการ PIN",
      icon: "password",
      adminOnly: true,
    },
    {
      id: "logout",
      href: "/logout",
      label: "ออกจากระบบ",
      icon: "logout",
      prefetch: false,
    },
  ];
  const visibleMenuItems =
    navRole === "admin" ? menuItems : menuItems.filter((item) => !item.adminOnly);
  const actionStyle = {
    display: "inline-flex",
    justifyContent: "center",
    width: "100%",
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/pin", { cache: "no-store" });
        const data = (await res.json()) as {
          firstName?: string;
          lastName?: string;
          role?: string;
          error?: string;
        };
        if (!res.ok || !data || "error" in data) return;
        const role = data.role === "admin" ? "admin" : "user";
        setNavRole(role);
      } catch {
        // ignore
      }
    };
    void loadProfile();
  }, [setNavRole]);

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
    <main className="pin-page pb-24 lg:pb-0">
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
        </form>
      </div>
      <div
        className="fixed bottom-0 left-0 w-full bg-white dark:bg-surface-dark border-t border-slate-100 dark:border-border-dark flex justify-around items-center py-2 px-6 z-30 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", height: "64px" }}
      >
        {visibleMenuItems.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={item.prefetch}
              className={`flex flex-col items-center gap-1 ${
                isActive ? "text-primary" : "text-slate-400"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon name={item.icon} className="h-6 w-6" bold={isActive} />
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
