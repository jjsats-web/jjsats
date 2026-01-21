"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import swal from "sweetalert";

type PinProfile = { firstName: string; lastName: string; role: "admin" | "user" };
type SwalIcon = "success" | "error" | "warning" | "info" | "question";

type Customer = {
  id: string;
  companyName: string;
  taxId: string;
  contactName: string;
  contactPhone: string;
  address: string;
  approxPurchaseDate: string;
  createdAt: string;
};

type CustomerDraft = Omit<Customer, "id" | "createdAt">;

const API = "/api/customers";

const initialDraft: CustomerDraft = {
  companyName: "",
  taxId: "",
  contactName: "",
  contactPhone: "",
  address: "",
  approxPurchaseDate: "",
};

function normalizeInput(value: string) {
  return value.trim();
}

function normalizeTaxId(value: string) {
  return value.replace(/\D/g, "").slice(0, 13);
}

const countFormatter = new Intl.NumberFormat("th-TH");

function formatCount(value: number) {
  return countFormatter.format(value);
}

function formatSignedCount(value: number) {
  if (value > 0) return `+${formatCount(value)}`;
  if (value < 0) return `-${formatCount(Math.abs(value))}`;
  return formatCount(value);
}

type RecentActionTone = "success" | "warning" | "info";

type RecentAction = {
  id: string;
  label: string;
  tone: RecentActionTone;
};

type MenuItem = {
  id: string;
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
};

export default function CustomerPage() {
  const [draft, setDraft] = useState<CustomerDraft>(initialDraft);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [pinProfile, setPinProfile] = useState<PinProfile>({
    firstName: "",
    lastName: "",
    role: "user",
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const showModal = async (title: string, icon: SwalIcon = "info") => {
    try {
      const SwalMod = await import("sweetalert2");
      const Swal = SwalMod.default;
      await Swal.fire({
        title,
        icon,
        confirmButtonText: "รับทราบ!",
      });
    } catch (error) {
      console.warn("SweetAlert2 not available, fallback to sweetalert", error);
      void swal(title);
    }
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API, { cache: "no-store" });
      const data = (await res.json()) as Customer[] | { error: string };
      if (!res.ok || !Array.isArray(data)) {
        return;
      }
      setCustomers(data);
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, []);

  const beginEdit = useCallback((customer: Customer) => {
    setEditingCustomerId(customer.id);
    setDraft({
      companyName: customer.companyName,
      taxId: customer.taxId,
      contactName: customer.contactName,
      contactPhone: customer.contactPhone,
      address: customer.address,
      approxPurchaseDate: customer.approxPurchaseDate,
    });
    document.getElementById("customerForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCustomerId(null);
    setDraft(initialDraft);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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
        setPinProfile({
          firstName: data.firstName?.trim() ?? "",
          lastName: data.lastName?.trim() ?? "",
          role: data.role === "admin" ? "admin" : "user",
        });
      } catch {
        // ignore
      }
    };
    void loadProfile();
  }, []);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: CustomerDraft = {
      companyName: normalizeInput(draft.companyName),
      taxId: normalizeTaxId(draft.taxId),
      contactName: normalizeInput(draft.contactName),
      contactPhone: normalizeInput(draft.contactPhone),
      address: normalizeInput(draft.address),
      approxPurchaseDate: normalizeInput(draft.approxPurchaseDate),
    };

    if (!payload.companyName) {
      await showModal("กรุณาระบุ “ชื่อบริษัท”", "warning");
      return;
    }

    if (payload.taxId && payload.taxId.length !== 13) {
      await showModal("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก", "warning");
      return;
    }

    setSaving(true);
    const wasEditing = Boolean(editingCustomerId);
    try {
      const targetUrl = editingCustomerId
        ? `${API}/${encodeURIComponent(editingCustomerId)}`
        : API;
      const res = await fetch(targetUrl, {
        method: editingCustomerId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Customer | { error: string };
      if (!res.ok || ("error" in data && data.error)) {
        await showModal("error" in data ? data.error : "เกิดข้อผิดพลาด", "error");
        return;
      }

      setEditingCustomerId(null);
      setDraft(initialDraft);
      await loadList();
      await showModal(wasEditing ? "Customer updated" : "บันทึกข้อมูลลูกค้าแล้ว", "success");
      document.getElementById("list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      await showModal("เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  };

  const emptyState = useMemo(() => {
    if (loading) return "กำลังโหลดข้อมูลลูกค้า…";
    if (customers.length) return "";
    return "ยังไม่มีข้อมูลลูกค้า";
  }, [customers.length, loading]);

  const customersThisMonth = useMemo(() => {
    if (!customers.length) return 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startTimestamp = startOfMonth.getTime();
    return customers.reduce((count, customer) => {
      const createdAt = Date.parse(customer.createdAt);
      if (Number.isNaN(createdAt)) return count;
      return createdAt >= startTimestamp ? count + 1 : count;
    }, 0);
  }, [customers]);

  const totalCustomersLabel = loading ? "-" : formatCount(customers.length);
  const customersThisMonthLabel = loading ? "-" : formatSignedCount(customersThisMonth);
  const displayName = `${pinProfile.firstName} ${pinProfile.lastName}`.trim();
  const activeHref = "/customer";
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
    { id: "logout", href: "/logout", label: "ออกจากระบบ", icon: "logout" },
  ];
  const visibleMenuItems =
    pinProfile.role === "admin"
      ? menuItems
      : menuItems.filter((item) => !item.adminOnly);
  const primaryMenuItems = visibleMenuItems.filter((item) => item.id !== "logout");
  const logoutMenuItem = visibleMenuItems.find((item) => item.id === "logout");
  const menuItemBase =
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors";
  const menuItemActive =
    "bg-primary text-white shadow-[0_10px_20px_rgba(0,124,138,0.2)]";
  const menuItemIdle =
    "text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800";

  const recentActions = useMemo<RecentAction[]>(() => {
    if (loading || !customers.length) return [];
    const tones: RecentActionTone[] = ["success", "warning", "info"];
    return customers
      .filter((customer) => customer.companyName)
      .slice(0, 3)
      .map((customer, index) => ({
        id: customer.id,
        label: `เพิ่มลูกค้า: ${customer.companyName}`,
        tone: tones[index % tones.length] ?? "info",
      }));
  }, [customers, loading]);

  return (
    <main>
      <div className="customer-desktop">
        <header className="topbar">
          <div className="topbar__brand">JJSATs Quotation</div>
          <nav>
            {visibleMenuItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={item.href === activeHref ? "active" : undefined}
                aria-current={item.href === activeHref ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

      <div className="container">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {pinProfile.firstName || pinProfile.lastName ? (
            <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              คุณ {`${pinProfile.firstName} ${pinProfile.lastName}`.trim()}
            </div>
          ) : null}
          <h1>ลงทะเบียนลูกค้า</h1>
        </div>

        <section className="dashboard-summary">
          <h2 className="dashboard-summary__title">สรุปข้อมูล</h2>
          <div className="dashboard-summary__content">
            <div className="dashboard-summary__cards">
              <article className="summary-card summary-card--rose">
                <div className="summary-card__icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <p className="summary-card__label">ลูกค้าทั้งหมด</p>
                  <p className="summary-card__value">{totalCustomersLabel}</p>
                </div>
              </article>
              <article className="summary-card summary-card--sky">
                <div className="summary-card__icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <div>
                  <p className="summary-card__label">เพิ่มขึ้นเดือนนี้</p>
                  <p className="summary-card__value">{customersThisMonthLabel}</p>
                </div>
              </article>
            </div>
            <div className="dashboard-summary__latest">
              <h3 className="dashboard-summary__subtitle">การดำเนินการล่าสุด</h3>
              <ul className="dashboard-summary__list">
                {recentActions.length ? (
                  recentActions.map((action) => (
                    <li key={action.id} className="dashboard-summary__item">
                      <span
                        className={`dashboard-summary__dot dashboard-summary__dot--${action.tone}`}
                      />
                      <span>{action.label}</span>
                    </li>
                  ))
                ) : (
                  <li className="dashboard-summary__empty">ยังไม่มีการดำเนินการล่าสุด</li>
                )}
              </ul>
            </div>
          </div>
        </section>

        <form id="customerForm" onSubmit={onSubmit} style={{ marginBottom: "1rem" }}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label htmlFor="companyName">ชื่อบริษัท</label>
              <input
                id="companyName"
                type="text"
                value={draft.companyName}
                onChange={(e) => setDraft((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="เช่น บริษัท เอ บี ซี จำกัด"
              />
            </div>
            <div>
              <label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี</label>
              <input
                id="taxId"
                type="text"
                value={draft.taxId}
                inputMode="numeric"
                maxLength={13}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, taxId: normalizeTaxId(e.target.value) }))
                }
                placeholder="13 หลัก"
              />
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label htmlFor="contactName">ชื่อผู้ติดต่อ</label>
              <input
                id="contactName"
                type="text"
                value={draft.contactName}
                onChange={(e) => setDraft((prev) => ({ ...prev, contactName: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="contactPhone">เบอร์ผู้ติดต่อ</label>
              <input
                id="contactPhone"
                type="text"
                value={draft.contactPhone}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, contactPhone: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label htmlFor="approxPurchaseDate">ประมาณวันที่ซื้อ</label>
              <input
                id="approxPurchaseDate"
                type="text"
                value={draft.approxPurchaseDate}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, approxPurchaseDate: e.target.value }))
                }
                placeholder="เช่น 2025-12-31 หรือ ภายใน Q1/2025"
              />
            </div>
            <div>
              <label htmlFor="address">ที่อยู่</label>
              <input
                id="address"
                type="text"
                value={draft.address}
                onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>
          </div>

          <div className="actions center">
            {editingCustomerId ? (
              <button
                type="button"
                className="ghost-link"
                style={{ cursor: "pointer" }}
                onClick={cancelEdit}
              >
                ยกเลิก
              </button>
            ) : null}
            <button type="submit" disabled={saving} className="blob-button">
              <span className="blob-button__text">
                {saving ? "กำลังบันทึก…" : editingCustomerId ? "อัปเดตลูกค้า" : "บันทึกลูกค้า"}
              </span>
              <span className="blob-button__inner" aria-hidden="true">
                <span className="blob-button__blobs">
                  <span className="blob-button__blob" />
                  <span className="blob-button__blob" />
                  <span className="blob-button__blob" />
                  <span className="blob-button__blob" />
                </span>
              </span>
            </button>
          </div>
        </form>

        <h2>รายชื่อลูกค้า</h2>
        <div id="list">
          {emptyState ? <div style={{ color: "var(--muted)" }}>{emptyState}</div> : null}
          {customers.map((customer) => {
            const display = customer.companyName.trim() || "(ไม่ระบุชื่อ)";
            return (
              <div key={customer.id} className="card">
                <div>
                  <div>
                    <strong>{display}</strong>
                  </div>
                  <div style={{ opacity: 0.7 }}>
                    {customer.contactName}{" "}
                    {customer.contactPhone ? `· ${customer.contactPhone}` : ""}
                  </div>
                  <div style={{ opacity: 0.7 }}>{customer.address}</div>
                  {customer.taxId ? (
                    <div style={{ opacity: 0.7, marginTop: ".25rem" }}>
                      เลขประจำตัวผู้เสียภาษี: {customer.taxId}
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ opacity: 0.7, fontSize: "0.9rem" }}>
                    {customer.approxPurchaseDate ? `คาดซื้อ: ${customer.approxPurchaseDate}` : ""}
                  </div>
                  <div
                    style={{
                      marginTop: ".4rem",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: ".25rem",
                    }}
                  >
                    <Link
                      className="card-action-link"
                      href={`/?customer=${encodeURIComponent(customer.id)}`}
                    >
                      เลือก
                    </Link>
                    <button
                      type="button"
                      className="card-action-link"
                      onClick={() => beginEdit(customer)}
                    >
                      แก้ไข
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <svg className="blob-button__svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="blob-button-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      </div>
      <div className="customer-mobile bg-background-light dark:bg-background-dark font-display antialiased text-text-primary-light dark:text-text-primary-dark h-screen overflow-hidden flex flex-col">
        <header className="flex-none bg-surface-light dark:bg-surface-dark shadow-sm z-10 sticky top-0 px-4 py-3 flex items-center justify-between border-b border-border-light dark:border-border-dark">
          <button
            type="button"
            className="flex items-center justify-center p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-primary-light dark:text-text-primary-dark"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="customer-app-menu"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span className="material-symbols-outlined text-[24px]">
              {isMenuOpen ? "close" : "menu"}
            </span>
          </button>
          <h1 className="text-lg font-bold tracking-tight text-center flex-1 pr-10">
            ลงทะเบียนลูกค้า
          </h1>
        </header>
        {isMenuOpen ? (
          <div className="fixed inset-0 z-40">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              onClick={() => setIsMenuOpen(false)}
            />
            <aside
              id="customer-app-menu"
              className="absolute left-0 top-0 h-full w-[290px] bg-surface-light dark:bg-surface-dark shadow-2xl p-5 flex flex-col gap-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-text-secondary-light dark:text-text-secondary-dark">
                    JJSATs
                  </div>
                  <div className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                    Quotation
                  </div>
                </div>
                <button
                  type="button"
                  className="flex items-center justify-center p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-primary-light dark:text-text-primary-dark"
                  aria-label="Close menu"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
              {displayName ? (
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  เธเธธเธ“ {displayName}
                </div>
              ) : null}
              <nav className="flex flex-col gap-2">
                {primaryMenuItems.map((item) => {
                  const isActive = item.href === activeHref;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`${menuItemBase} ${isActive ? menuItemActive : menuItemIdle}`}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span
                        className={`material-symbols-outlined text-[20px] ${
                          isActive ? "text-white" : "text-primary"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              {logoutMenuItem ? (
                <div className="mt-auto">
                  <Link
                    href={logoutMenuItem.href}
                    className={`${menuItemBase} ${menuItemIdle}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary">
                      {logoutMenuItem.icon}
                    </span>
                    <span>{logoutMenuItem.label}</span>
                  </Link>
                </div>
              ) : null}

            </aside>
          </div>
        ) : null}
        <main className="flex-1 overflow-y-auto no-scrollbar p-4 pb-32">
          <form id="customerFormMobile" onSubmit={onSubmit} className="space-y-6">
            <section className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-soft p-5 border border-transparent dark:border-border-dark">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <span className="material-symbols-outlined text-[20px]">person</span>
                <h3 className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark">
                  ข้อมูลลูกค้า
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                    ชื่อบริษัท
                  </label>
                  <input
                    className="w-full rounded-lg bg-background-light dark:bg-background-dark border border-gray-200 dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary text-base py-3 px-4 placeholder-gray-400 dark:placeholder-gray-600 transition-shadow"
                    placeholder="เช่น บริษัท เอ บี ซี จำกัด"
                    type="text"
                    value={draft.companyName}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, companyName: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                      เลขประจำตัวผู้เสียภาษี
                    </label>
                    <input
                      className="w-full rounded-lg bg-background-light dark:bg-background-dark border border-gray-200 dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary text-base py-3 px-4 placeholder-gray-400"
                      inputMode="numeric"
                      placeholder="13 หลัก"
                      type="text"
                      value={draft.taxId}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          taxId: normalizeTaxId(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                      ชื่อผู้ติดต่อ
                    </label>
                    <input
                      className="w-full rounded-lg bg-background-light dark:bg-background-dark border border-gray-200 dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary text-base py-3 px-4 placeholder-gray-400"
                      type="text"
                      value={draft.contactName}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, contactName: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                      เบอร์ผู้ติดต่อ
                    </label>
                    <input
                      className="w-full rounded-lg bg-background-light dark:bg-background-dark border border-gray-200 dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary text-base py-3 px-4 placeholder-gray-400"
                      type="text"
                      value={draft.contactPhone}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, contactPhone: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                      ประมาณวันที่ซื้อ
                    </label>
                    <input
                      className="w-full rounded-lg bg-background-light dark:bg-background-dark border border-gray-200 dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary text-base py-3 px-4 placeholder-gray-400"
                      type="text"
                      placeholder="เช่น 2025-12-31 หรือ ภายใน Q1/2025"
                      value={draft.approxPurchaseDate}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, approxPurchaseDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                    ที่อยู่
                  </label>
                  <input
                    className="w-full rounded-lg bg-background-light dark:bg-background-dark border border-gray-200 dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary text-base py-3 px-4 placeholder-gray-400"
                    type="text"
                    value={draft.address}
                    onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>
            </section>
          </form>
        </main>
        <footer className="fixed bottom-0 left-0 w-full bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark p-4 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] z-20 safe-area-bottom">
          <div className="flex gap-3 max-w-lg mx-auto">
            <button
              type="button"
              className="flex-1 py-3.5 px-4 rounded-lg font-semibold text-text-secondary-light dark:text-text-secondary-dark bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={cancelEdit}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="customerFormMobile"
              disabled={saving}
              className="flex-1 py-3.5 px-4 rounded-lg font-bold text-white bg-primary hover:bg-primary-dark shadow-[0_10px_20px_rgba(0,124,138,0.3)] transition-all transform active:scale-[0.98]"
            >
              {saving ? "กำลังบันทึก…" : editingCustomerId ? "อัปเดตลูกค้า" : "บันทึกลูกค้า"}
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
