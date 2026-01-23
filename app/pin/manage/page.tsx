"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";

type PinEntry = {
  id: string;
  pin: string;
  firstName: string;
  lastName: string;
  signatureImage: string;
  createdAt: string;
};

type PinProfile = {
  role: "admin" | "user";
};

type MenuItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  prefetch?: boolean;
};

type PinDraft = {
  pin: string;
  firstName: string;
  lastName: string;
  signatureImage: string;
};

const PIN_LENGTH = 6;
const MAX_SIGNATURE_SIZE = 1024 * 1024;
const initialDraft: PinDraft = { pin: "", firstName: "", lastName: "", signatureImage: "" };

function formatDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export default function PinManagePage() {
  const [pins, setPins] = useState<PinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<PinDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [pinProfile, setPinProfile] = useState<PinProfile>({ role: "user" });
  const activeHref = "/pin/manage";
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
    pinProfile.role === "admin"
      ? menuItems
      : menuItems.filter((item) => !item.adminOnly);

  const loadPins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pins", { cache: "no-store" });
      const data = (await res.json()) as PinEntry[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) {
        const message =
          !res.ok && "error" in data && typeof data.error === "string"
            ? data.error
            : "โหลดรายการ PIN ไม่สำเร็จ";
        setError(message);
        return;
      }
      setPins(data);
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดรายการ PIN");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/pin", { cache: "no-store" });
        const data = (await res.json()) as { role?: string; error?: string };
        if (!res.ok || !data || "error" in data) return;
        setPinProfile({ role: data.role === "admin" ? "admin" : "user" });
      } catch {
        // ignore
      }
    };
    void loadProfile();
  }, []);

  const startEdit = (entry: PinEntry) => {
    setEditingId(entry.id);
    setDraft({
      pin: entry.pin ?? "",
      firstName: entry.firstName ?? "",
      lastName: entry.lastName ?? "",
      signatureImage: entry.signatureImage ?? "",
    });
    setActionError("");
  };

  const cancelEdit = () => {
    setEditingId("");
    setDraft(initialDraft);
    setActionError("");
  };

  const handleSave = async () => {
    if (!editingId) return;
    const nextPin = draft.pin.trim();
    const nextFirst = draft.firstName.trim();
    const nextLast = draft.lastName.trim();
    const nextSignature = draft.signatureImage.trim();

    if (!nextFirst || !nextLast) {
      setActionError("กรุณากรอกชื่อและนามสกุล");
      return;
    }

    if (!/^\d+$/.test(nextPin) || nextPin.length !== PIN_LENGTH) {
      setActionError(`กรุณากรอก PIN ${PIN_LENGTH} หลัก`);
      return;
    }

    setSaving(true);
    setActionError("");
    try {
      const res = await fetch(`/api/pins/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: nextPin,
          firstName: nextFirst,
          lastName: nextLast,
          signatureImage: nextSignature || null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as PinEntry | { error?: string };
      if (!res.ok || !payload || "error" in payload) {
        const message =
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "เกิดข้อผิดพลาด";
        setActionError(message);
        return;
      }

      const updated = payload as PinEntry;
      setPins((prev) => prev.map((pin) => (pin.id === updated.id ? updated : pin)));
      cancelEdit();
    } catch {
      setActionError("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingId) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setActionError("กรุณาเลือกไฟล์รูปภาพลายเซ็น");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SIGNATURE_SIZE) {
      setActionError("ไฟล์ลายเซ็นต้องไม่เกิน 1MB");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        setActionError("อ่านไฟล์ลายเซ็นไม่สำเร็จ");
        return;
      }
      setDraft((prev) => ({ ...prev, signatureImage: result }));
      setActionError("");
    };
    reader.onerror = () => {
      setActionError("อ่านไฟล์ลายเซ็นไม่สำเร็จ");
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (entry: PinEntry) => {
    const ok = confirm("ต้องการลบ PIN นี้หรือไม่?");
    if (!ok) return;
    setDeletingId(entry.id);
    setActionError("");
    try {
      const res = await fetch(`/api/pins/${entry.id}`, { method: "DELETE" });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(payload.error || "เกิดข้อผิดพลาดในการลบ PIN");
        return;
      }
      setPins((prev) => prev.filter((pin) => pin.id !== entry.id));
      if (editingId === entry.id) cancelEdit();
    } catch {
      setActionError("เกิดข้อผิดพลาดในการลบ PIN");
    } finally {
      setDeletingId("");
    }
  };

  const emptyText = useMemo(() => {
    if (loading) return "กำลังโหลดรายการ PIN…";
    if (!pins.length) return "ยังไม่มี PIN";
    return "";
  }, [loading, pins.length]);

  return (
    <main className="pb-24 lg:pb-0">
      <header className="topbar">
        <div className="topbar__brand">JJSATs Quotation</div>
      </header>

      <div className="container">
        <h1>จัดการ PIN</h1>
        <p style={{ color: "var(--muted)", marginTop: "-0.4rem" }}>
          ดู แก้ไข หรือลบ PIN ของผู้ใช้งานในระบบ
        </p>
        <div className="actions" style={{ justifyContent: "flex-start", marginTop: "0.8rem" }}>
          <Link href="/pin/register" className="ghost-link">
            + เพิ่ม PIN
          </Link>
        </div>

        {error ? <div style={{ color: "#b91c1c", marginTop: ".6rem" }}>{error}</div> : null}
        {actionError ? (
          <div style={{ color: "#b91c1c", marginTop: ".6rem" }}>{actionError}</div>
        ) : null}

        <div className="table-scroll" style={{ marginTop: "0.8rem" }}>
          <table className="table" id="pinTable">
            <thead>
              <tr>
                <th>ผู้ใช้งาน</th>
                <th>PIN</th>
                <th>สร้างเมื่อ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {emptyText ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: "1rem",
                    }}
                  >
                    {emptyText}
                  </td>
                </tr>
              ) : null}
              {pins.map((entry) => {
                const isEditing = editingId === entry.id;
                return (
                  <tr key={entry.id}>
                    <td style={{ minWidth: "180px" }}>
                      {isEditing ? (
                        <div style={{ display: "grid", gap: ".4rem" }}>
                          <input
                            type="text"
                            value={draft.firstName}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, firstName: e.target.value }))
                            }
                            placeholder="ชื่อ"
                          />
                          <input
                            type="text"
                            value={draft.lastName}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, lastName: e.target.value }))
                            }
                            placeholder="นามสกุล"
                          />
                          <div style={{ display: "grid", gap: ".35rem" }}>
                            <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>
                              ลายเซ็น
                            </span>
                            <input
                              id={`signature-${entry.id}`}
                              type="file"
                              accept="image/*"
                              onChange={handleSignatureChange}
                            />
                            {draft.signatureImage ? (
                              <Image
                                src={draft.signatureImage}
                                width={140}
                                height={60}
                                unoptimized
                                alt="ลายเซ็น"
                                style={{
                                  maxWidth: "140px",
                                  maxHeight: "60px",
                                  objectFit: "contain",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "8px",
                                  padding: "6px",
                                  background: "#fff",
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <strong>
                          {`${entry.firstName} ${entry.lastName}`.trim() || "-"}
                        </strong>
                      )}
                    </td>
                    <td style={{ textAlign: "center", minWidth: "120px" }}>
                      {isEditing ? (
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={draft.pin}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              pin: e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH),
                            }))
                          }
                          placeholder="เช่น 123456"
                          maxLength={PIN_LENGTH}
                        />
                      ) : (
                        entry.pin || "-"
                      )}
                    </td>
                    <td style={{ minWidth: "140px" }}>{formatDate(entry.createdAt)}</td>
                    <td style={{ textAlign: "right", minWidth: "160px" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: ".4rem", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="ghost-link"
                            style={{ border: "none", padding: ".45rem .7rem" }}
                            onClick={handleSave}
                            disabled={saving}
                          >
                            บันทึก
                          </button>
                          <button
                            type="button"
                            className="ghost-link"
                            style={{ border: "none", padding: ".45rem .7rem" }}
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: ".45rem", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="ghost-link"
                            style={{ border: "none", padding: ".45rem .7rem" }}
                            onClick={() => startEdit(entry)}
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            className="remove"
                            style={{ border: "none", padding: ".45rem .7rem" }}
                            onClick={() => void handleDelete(entry)}
                            disabled={deletingId === entry.id}
                          >
                            ลบ
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
