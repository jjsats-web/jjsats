"use client";

import Image from "next/image";
import AdminPageHeading from "@/components/AdminPageHeading";
import AdminSidebar from "@/components/AdminSidebar";
import AdminTopBar from "@/components/AdminTopBar";
import BottomNav from "@/components/BottomNav";
import Icon, { type IconName } from "@/components/Icon";
import { usePinRole } from "@/components/PinRoleProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./register.css";

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

type PinEntry = {
  id: string;
  firstName: string;
  lastName: string;
  signatureImage: string;
  createdAt: string;
};

type PinDraft = {
  pin: string;
  firstName: string;
  lastName: string;
  signatureImage: string;
};

const initialEditDraft: PinDraft = { pin: "", firstName: "", lastName: "", signatureImage: "" };

function formatDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

const menuItems: MenuItem[] = [
    { id: "quote2", href: "/quotation", label: "ใบเสนอราคา", icon: "description" },
  { id: "customer", href: "/customer", label: "ทะเบียนลูกค้า", icon: "group", adminOnly: true },
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
    id: "logout",
    href: "/logout",
    label: "ออกจากระบบ",
    icon: "logout",
    prefetch: false,
  },
];

export default function PinRegisterPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [pins, setPins] = useState<PinEntry[]>([]);
  const [loadingPins, setLoadingPins] = useState(true);
  const [pinListError, setPinListError] = useState("");
  const [pinActionError, setPinActionError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState<PinDraft>(initialEditDraft);
  const [savingPin, setSavingPin] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { role: navRole, setRole: setNavRole } = usePinRole();
  const activeHref = "/pin/register";
  const visibleMenuItems =
    navRole === "admin" ? menuItems : menuItems.filter((item) => !item.adminOnly);

  const loadPins = useCallback(async () => {
    setLoadingPins(true);
    setPinListError("");
    try {
      const res = await fetch("/api/pins", { cache: "no-store" });
      const data = (await res.json()) as PinEntry[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) {
        const message =
          !res.ok && "error" in data && typeof data.error === "string"
            ? data.error
            : "โหลดรายการ PIN ไม่สำเร็จ";
        setPinListError(message);
        return;
      }
      setPins(data);
    } catch {
      setPinListError("เกิดข้อผิดพลาดในการโหลดรายการ PIN");
    } finally {
      setLoadingPins(false);
    }
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/pin", { cache: "no-store" });
        const data = (await res.json()) as {
          role?: string;
          error?: string;
        };
        if (!res.ok || !data || "error" in data) return;
        setNavRole(data.role === "admin" ? "admin" : "user");
      } catch {
        // Keep the existing navigation role if profile loading fails.
      }
    };
    void loadProfile();
  }, [setNavRole]);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

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

  const startEdit = (entry: PinEntry) => {
    setEditingId(entry.id);
    setEditDraft({
      pin: "",
      firstName: entry.firstName ?? "",
      lastName: entry.lastName ?? "",
      signatureImage: entry.signatureImage ?? "",
    });
    setPinActionError("");
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditDraft(initialEditDraft);
    setPinActionError("");
  };

  const handleEditSignatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingId) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPinActionError("กรุณาเลือกไฟล์รูปภาพลายเซ็น");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SIGNATURE_SIZE) {
      setPinActionError("ไฟล์ลายเซ็นต้องไม่เกิน 1MB");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        setPinActionError("อ่านไฟล์ลายเซ็นไม่สำเร็จ");
        return;
      }
      setEditDraft((prev) => ({ ...prev, signatureImage: result }));
      setPinActionError("");
    };
    reader.onerror = () => {
      setPinActionError("อ่านไฟล์ลายเซ็นไม่สำเร็จ");
    };
    reader.readAsDataURL(file);
  };

  const handleSavePin = async () => {
    if (!editingId) return;
    const nextPin = editDraft.pin.trim();
    const nextFirst = editDraft.firstName.trim();
    const nextLast = editDraft.lastName.trim();
    const nextSignature = editDraft.signatureImage.trim();

    if (!nextFirst || !nextLast) {
      setPinActionError("กรุณากรอกชื่อและนามสกุล");
      return;
    }

    if (nextPin && (!/^\d+$/.test(nextPin) || nextPin.length !== PIN_LENGTH)) {
      setPinActionError(`กรุณากรอก PIN ${PIN_LENGTH} หลัก`);
      return;
    }

    setSavingPin(true);
    setPinActionError("");
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
        setPinActionError(message);
        return;
      }

      const updated = payload as PinEntry;
      setPins((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      cancelEdit();
    } catch {
      setPinActionError("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSavingPin(false);
    }
  };

  const handleDeletePin = async (entry: PinEntry) => {
    try {
      const SwalMod = await import("sweetalert2");
      const Swal = SwalMod.default;
      const result = await Swal.fire({
        title: "ต้องการลบ PIN นี้หรือไม่?",
        text: `คุณกำลังจะลบ PIN ของคุณ ${entry.firstName} ${entry.lastName}`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "ใช่, ลบเลย",
        cancelButtonText: "ยกเลิก",
      });
      if (!result.isConfirmed) return;
    } catch {
      const ok = confirm("ต้องการลบ PIN นี้หรือไม่?");
      if (!ok) return;
    }

    setDeletingId(entry.id);
    setPinActionError("");
    try {
      const res = await fetch(`/api/pins/${entry.id}`, { method: "DELETE" });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPinActionError(payload.error || "เกิดข้อผิดพลาดในการลบ PIN");
        return;
      }
      setPins((prev) => prev.filter((pinEntry) => pinEntry.id !== entry.id));
      if (editingId === entry.id) cancelEdit();

      try {
        const SwalMod = await import("sweetalert2");
        const Swal = SwalMod.default;
        await Swal.fire({
          title: "ลบสำเร็จ!",
          text: `ลบ PIN ของคุณ ${entry.firstName} ${entry.lastName} เรียบร้อยแล้ว`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch {
        // Fallback or ignore
      }
    } catch {
      setPinActionError("เกิดข้อผิดพลาดในการลบ PIN");
    } finally {
      setDeletingId("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
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
      setError("กรุณาเลือกบทบาทให้ถูกต้อง");
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
      setFirstName("");
      setLastName("");
      setPin("");
      setConfirmPin("");
      setSignatureData("");
      setRole("user");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setNotice("บันทึก PIN แล้ว");
      await loadPins();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setPending(false);
    }
  };

  const filteredPins = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return pins;
    return pins.filter((entry) =>
      [entry.firstName, entry.lastName, formatDate(entry.createdAt)]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [pins, searchTerm]);

  const listEmptyText = (() => {
    if (searchTerm.trim() && !filteredPins.length) return "ไม่พบ PIN ที่ค้นหา";
    if (loadingPins) return "กำลังโหลดรายการ PIN…";
    if (!pins.length) return "ยังไม่มี PIN";
    return "";
  })();

  return (
    <main className="pin-register-page pin-register-page-stitch pt-16 pb-24 lg:pb-0">
      <div className="pin-register-desktop pin-register-stitch">
        <AdminSidebar items={visibleMenuItems} activeHref={activeHref} />
        <AdminTopBar
          title="จัดการ PIN"
          subtitle="Access Management"
          leftOffset="15rem"
          profileRole={navRole === "admin" ? "Administrator" : "User"}
        />
      </div>

      <section className="pin-register-shell">
        <AdminPageHeading
          title="ตั้งค่า PIN"
          icon="password"
          meta="จัดการสิทธิ์การเข้าถึงระบบ"
        />

        <div className="pin-register-workspace">
        <form onSubmit={submit} className="pin-register-card">
          <div className="pin-register-form-header">
            <div>
              <h2>ลงทะเบียนผู้ใช้งานใหม่</h2>
              <p>ระบุข้อมูลเพื่อสร้างบัญชีผู้ใช้งานและกำหนดสิทธิ์การเข้าถึงระบบ</p>
            </div>
            <span className="pin-register-form-header__icon">
              <Icon name="person_add" />
            </span>
          </div>
          <div className="pin-register-grid">
            <section className="pin-register-section">
              <h2>ข้อมูลส่วนตัว</h2>

              <label htmlFor="firstName">ชื่อ</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="กรอกชื่อของคุณ"
              />

              <label htmlFor="lastName">นามสกุล</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="กรอกนามสกุลของคุณ"
              />

              <label htmlFor="role">บทบาท</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </section>

            <section className="pin-register-section pin-register-section--security">
              <h2>ความปลอดภัย</h2>

              <label htmlFor="signatureImage">อัปโหลดรูปภาพลายเซ็น</label>
              <input
                ref={fileInputRef}
                id="signatureImage"
                className="pin-register-file"
                type="file"
                accept="image/*"
                onChange={handleSignatureChange}
              />
              <button
                type="button"
                className="pin-register-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="app_registration" className="h-10 w-10" />
                <span>อัปโหลดรูปภาพลายเซ็น</span>
                <strong>เลือกไฟล์</strong>
              </button>

              {signatureData ? (
                <div className="pin-register-signature">
                  <Image
                    src={signatureData}
                    width={140}
                    height={56}
                    unoptimized
                    alt="ลายเซ็น"
                  />
                </div>
              ) : null}

              <label htmlFor="pin">ตั้งรหัส PIN (6 หลัก)</label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
                }
                placeholder="••••••"
                maxLength={PIN_LENGTH}
              />

              <label htmlFor="confirmPin">ยืนยันรหัส PIN</label>
              <input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
                }
                placeholder="••••••"
                maxLength={PIN_LENGTH}
              />
            </section>
          </div>

          {error ? <div className="pin-register-error">{error}</div> : null}
          {notice ? <div className="pin-register-notice">{notice}</div> : null}

          <button type="submit" className="pin-register-submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึก PIN"}
          </button>
        </form>

        <aside className="pin-register-overview" aria-label="ภาพรวมการจัดการผู้ใช้งาน">
          <article className="pin-register-overview__metric">
            <div className="pin-register-overview__icon"><Icon name="person_add" /></div>
            <p>ผู้ใช้งานในระบบ</p>
            <strong>{loadingPins ? "-" : pins.length}</strong>
            <span>บัญชีที่ลงทะเบียนแล้ว</span>
          </article>
          <article className="pin-register-overview__help">
            <div className="pin-register-overview__icon"><Icon name="password" /></div>
            <h3>แนวทางความปลอดภัย</h3>
            <p>ใช้ PIN 6 หลักที่คาดเดายาก และอัปโหลดลายเซ็นเพื่อใช้ยืนยันตัวตนในเอกสาร</p>
          </article>
        </aside>
        </div>

        <section className="pin-register-history">
          <div className="pin-manage-heading">
            <div>
              <h1>ประวัติ / จัดการ PIN</h1>
              <p>แก้ไขข้อมูลผู้ใช้ เปลี่ยน PIN หรือลบรายการได้จากส่วนนี้</p>
            </div>
          </div>

          <div className="pin-manage-toolbar">
            <label className="pin-manage-search">
              <Icon name="search" className="h-4 w-4" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search"
              />
            </label>
            <span className="pin-manage-count">
              {loadingPins ? "กำลังโหลด..." : `${filteredPins.length} รายการ`}
            </span>
          </div>

          {pinListError ? <div className="pin-manage-error">{pinListError}</div> : null}
          {pinActionError ? <div className="pin-manage-error">{pinActionError}</div> : null}

          <div className="pin-manage-table-wrap">
            <table className="pin-manage-table">
              <thead>
                <tr>
                  <th>ผู้ใช้งาน</th>
                  <th>PIN</th>
                  <th>สร้างเมื่อ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listEmptyText ? (
                  <tr>
                    <td colSpan={4} className="pin-manage-table__empty">
                      {listEmptyText}
                    </td>
                  </tr>
                ) : null}
                {filteredPins.map((entry) => {
                  const isEditing = editingId === entry.id;
                  return (
                    <tr key={entry.id}>
                      <td>
                        {isEditing ? (
                          <div className="pin-manage-edit-fields">
                            <input
                              type="text"
                              value={editDraft.firstName}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, firstName: e.target.value }))
                              }
                              placeholder="ชื่อ"
                            />
                            <input
                              type="text"
                              value={editDraft.lastName}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, lastName: e.target.value }))
                              }
                              placeholder="นามสกุล"
                            />
                            <div className="pin-manage-signature-field">
                              <span>ลายเซ็น</span>
                              <input type="file" accept="image/*" onChange={handleEditSignatureChange} />
                              {editDraft.signatureImage ? (
                                <Image
                                  src={editDraft.signatureImage}
                                  width={140}
                                  height={60}
                                  unoptimized
                                  alt="ลายเซ็น"
                                  className="pin-register-history__signature"
                                />
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <strong>{`${entry.firstName} ${entry.lastName}`.trim() || "-"}</strong>
                        )}
                      </td>
                      <td className="pin-manage-table__pin">
                        {isEditing ? (
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="new-password"
                            value={editDraft.pin}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                pin: e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH),
                              }))
                            }
                            placeholder="เว้นว่างหากไม่เปลี่ยน"
                            maxLength={PIN_LENGTH}
                          />
                        ) : (
                          "••••••"
                        )}
                      </td>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>
                        {isEditing ? (
                          <div className="pin-manage-row-actions">
                            <button
                              type="button"
                              className="pin-manage-save"
                              onClick={handleSavePin}
                              disabled={savingPin}
                            >
                              บันทึก
                            </button>
                            <button
                              type="button"
                              className="pin-manage-secondary"
                              onClick={cancelEdit}
                              disabled={savingPin}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <div className="pin-manage-row-actions">
                            <button
                              type="button"
                              className="pin-manage-icon-button"
                              onClick={() => startEdit(entry)}
                              aria-label={`แก้ไข ${entry.firstName} ${entry.lastName}`.trim()}
                              title="แก้ไข"
                            >
                              <Icon name="edit" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="pin-manage-icon-button pin-manage-icon-button--danger"
                              onClick={() => void handleDeletePin(entry)}
                              disabled={deletingId === entry.id}
                              aria-label={`ลบ ${entry.firstName} ${entry.lastName}`.trim()}
                              title="ลบ"
                            >
                              <Icon name="delete" className="h-4 w-4" />
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
        </section>
      </section>

      <BottomNav items={visibleMenuItems} activeHref={activeHref} />
    </main>
  );
}
