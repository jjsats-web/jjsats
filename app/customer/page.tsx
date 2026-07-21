"use client";

import Link from "next/link";
import AdminPageHeading from "@/components/AdminPageHeading";
import AdminSidebar from "@/components/AdminSidebar";
import AdminTopBar from "@/components/AdminTopBar";
import BottomNav from "@/components/BottomNav";
import Icon, { type IconName } from "@/components/Icon";
import { usePinRole } from "@/components/PinRoleProvider";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import swal from "sweetalert";
import "./customer.css";

type PinProfile = { firstName: string; lastName: string; role: "admin" | "user" };
type SwalIcon = "success" | "error" | "warning" | "info" | "question";

type Customer = {
  id: string;
  companyName: string;
  taxId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
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
  contactEmail: "",
  address: "",
  approxPurchaseDate: "",
};

function normalizeInput(value: string) {
  return value.trim();
}

function normalizeTaxId(value: string) {
  return value.replace(/\D/g, "").slice(0, 13);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  icon: IconName;
  adminOnly?: boolean;
  prefetch?: boolean;
};

export default function CustomerPage() {
  const [draft, setDraft] = useState<CustomerDraft>(initialDraft);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { role, setRole } = usePinRole();
  const [pinProfile, setPinProfile] = useState<PinProfile>({
    firstName: "",
    lastName: "",
    role: "user",
  });

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
    setLoadError("");
    try {
      const res = await fetch(API, {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await res.json()) as Customer[] | { error: string };
      if (!res.ok || !Array.isArray(data)) {
        setLoadError(!Array.isArray(data) && "error" in data ? data.error : "โหลดข้อมูลลูกค้าไม่สำเร็จ");
        return;
      }
      setCustomers(data);
    } catch {
      setLoadError("โหลดข้อมูลลูกค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  const scrollToCustomerForm = useCallback((formId: string) => {
    window.setTimeout(() => {
      const form = document.getElementById(formId);
      if (!form) return;
      const topbarOffset = window.matchMedia("(max-width: 768px)").matches ? 76 : 92;
      const targetTop = Math.max(0, form.getBoundingClientRect().top + window.scrollY - topbarOffset);
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    }, 0);
  }, []);

  const beginEdit = useCallback((customer: Customer) => {
    setEditingCustomerId(customer.id);
    setDraft({
      companyName: customer.companyName,
      taxId: customer.taxId,
      contactName: customer.contactName,
      contactPhone: customer.contactPhone,
      contactEmail: customer.contactEmail,
      address: customer.address,
      approxPurchaseDate: customer.approxPurchaseDate,
    });
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const formId = isMobile ? "customerFormMobile" : "customerForm";
    scrollToCustomerForm(formId);
  }, [scrollToCustomerForm]);

  const cancelEdit = useCallback(() => {
    setEditingCustomerId(null);
    setDraft(initialDraft);
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const formId = isMobile ? "customerFormMobile" : "customerForm";
    scrollToCustomerForm(formId);
  }, [scrollToCustomerForm]);

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
        const role = data.role === "admin" ? "admin" : "user";
        setPinProfile({
          firstName: data.firstName?.trim() ?? "",
          lastName: data.lastName?.trim() ?? "",
          role,
        });
        setRole(role);
      } catch {
        // ignore
      }
    };
    void loadProfile();
  }, [setRole]);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: CustomerDraft = {
      companyName: normalizeInput(draft.companyName),
      taxId: normalizeTaxId(draft.taxId),
      contactName: normalizeInput(draft.contactName),
      contactPhone: normalizeInput(draft.contactPhone),
      contactEmail: normalizeEmail(draft.contactEmail),
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

    if (payload.contactEmail && !isValidEmail(payload.contactEmail)) {
      await showModal("Invalid E-mail format", "warning");
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
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
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
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const listId = isMobile ? "listMobile" : "list";
      document.getElementById(listId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      await showModal("เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.companyName, c.contactName, c.contactPhone, c.contactEmail, c.address, c.taxId]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [customers, searchTerm]);

  const emptyState = useMemo(() => {
    if (loading) return "กำลังโหลดข้อมูลลูกค้า…";
    if (searchTerm.trim() && !filteredCustomers.length) return "ไม่พบข้อมูลลูกค้าที่ค้นหา";
    if (!customers.length) return "ยังไม่มีข้อมูลลูกค้า";
    return "";
  }, [customers.length, filteredCustomers.length, loading, searchTerm]);

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
  const activeHref = "/customer";
  const menuItems: MenuItem[] = [
    { id: "quote2", href: "/quotation", label: "ใบเสนอราคา", icon: "description" },
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
      id: "logout",
      href: "/logout",
      label: "ออกจากระบบ",
      icon: "logout",
      prefetch: false,
    },
  ];
  const visibleMenuItems =
    role === "admin" ? menuItems : menuItems.filter((item) => !item.adminOnly);

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
    <main className={`customer-admin-page customer-admin-page-stitch pt-16 pb-24 lg:pb-0 ${editingCustomerId ? "is-editing" : ""}`}>
      <div className="customer-desktop customer-stitch">
        <AdminSidebar items={visibleMenuItems} activeHref={activeHref} />

        <AdminTopBar
          title="ทะเบียนลูกค้า"
          subtitle="จัดการข้อมูลลูกค้า"
          leftOffset="15rem"
          profileName={`${pinProfile.firstName} ${pinProfile.lastName}`.trim()}
          profileRole={role === "admin" ? "Administrator" : "User"}
        />

      <div className="customer-admin-shell">
        <AdminPageHeading
          title="ลงทะเบียนลูกค้า"
          icon="group"
          meta={pinProfile.firstName || pinProfile.lastName
            ? `คุณ ${`${pinProfile.firstName} ${pinProfile.lastName}`.trim()}`
            : "จัดการข้อมูลลูกค้า"}
        />

        <div className="customer-page-split-layout">
          {/* Main content: Form */}
          <div className="customer-page-main-content">
            {loadError ? (
              <div
                style={{
                  marginBottom: "1rem",
                  padding: "0.9rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid #fca5a5",
                  background: "#fff1f2",
                  color: "#9f1239",
                }}
              >
                โหลดข้อมูลลูกค้าไม่สำเร็จ: {loadError}
              </div>
            ) : null}

            <form id="customerForm" onSubmit={onSubmit} className="customer-admin-form-modern">
              <div className="customer-form-split">
                {/* Left Column: ข้อมูลบริษัท */}
                <div className="customer-form-section">
                  <h3 className="customer-form-section-title">ข้อมูลบริษัท</h3>
                  
                  <div className="customer-form-field">
                    <label htmlFor="companyName">ชื่อบริษัท</label>
                    <input
                      id="companyName"
                      type="text"
                      value={draft.companyName}
                      onChange={(e) => setDraft((prev) => ({ ...prev, companyName: e.target.value }))}
                      placeholder="กรอกชื่อของคุณ"
                    />
                  </div>

                  <div className="customer-form-field">
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
                      placeholder="เลขประจำตัวผู้เสียภาษี"
                    />
                  </div>

                  <div className="customer-form-field">
                    <label htmlFor="contactName">ชื่อผู้ติดต่อ</label>
                    <input
                      id="contactName"
                      type="text"
                      value={draft.contactName}
                      onChange={(e) => setDraft((prev) => ({ ...prev, contactName: e.target.value }))}
                      placeholder="กรอกนามสกุลของคุณ"
                    />
                  </div>

                  <div className="customer-form-field">
                    <label htmlFor="contactPhone">เบอร์ผู้ติดต่อ</label>
                    <input
                      id="contactPhone"
                      type="text"
                      value={draft.contactPhone}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, contactPhone: e.target.value }))
                      }
                      placeholder="เบอร์ผู้ติดต่อของคุณ"
                    />
                  </div>
                </div>

                {/* Right Column: ข้อมูลการติดต่อและสั่งซื้อ */}
                <div className="customer-form-section">
                  <h3 className="customer-form-section-title">ข้อมูลการติดต่อและสั่งซื้อ</h3>

                  <div className="customer-form-field">
                    <label htmlFor="contactEmail">E-mail</label>
                    <input
                      id="contactEmail"
                      type="email"
                      value={draft.contactEmail}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, contactEmail: e.target.value }))
                      }
                      placeholder="E-mail"
                    />
                  </div>

                  <div className="customer-form-field">
                    <label htmlFor="approxPurchaseDate">ประมาณวันที่ซื้อ</label>
                    <div className="input-with-icon-wrapper">
                      <input
                        id="approxPurchaseDate"
                        type="text"
                        value={draft.approxPurchaseDate}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, approxPurchaseDate: e.target.value }))
                        }
                        placeholder="ประมาณวันที่ซื้อ"
                      />
                      <div className="input-calendar-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                          <line x1="16" x2="16" y1="2" y2="6"/>
                          <line x1="8" x2="8" y1="2" y2="6"/>
                          <line x1="3" x2="21" y1="10" y2="10"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="customer-form-field">
                    <label htmlFor="address">ที่อยู่</label>
                    <textarea
                      id="address"
                      value={draft.address}
                      onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="ที่อยู่"
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <div className="customer-form-actions-modern">
                {editingCustomerId ? (
                  <button
                    type="button"
                    className="customer-btn-cancel-modern"
                    onClick={cancelEdit}
                  >
                    ยกเลิก
                  </button>
                ) : null}
                <button type="submit" disabled={saving} className="customer-btn-submit-modern">
                  {saving ? "กำลังบันทึก…" : editingCustomerId ? "อัปเดตลูกค้า" : "บันทึกลูกค้า"}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar content: Metric Cards & Actions */}
          <aside className="customer-page-sidebar">
            <div className="customer-sidebar-grid">
              {/* Card 1 */}
              <div className="customer-metric-card">
                <div className="customer-metric-card-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="text-[#741010]">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div className="customer-metric-card-value">{totalCustomersLabel}</div>
                <div className="customer-metric-card-label">ลูกค้าทั้งหมด</div>
              </div>

              {/* Card 2 */}
              <div className="customer-metric-card">
                <div className="customer-metric-card-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#741010]">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                    <line x1="16" x2="16" y1="2" y2="6"/>
                    <line x1="8" x2="8" y1="2" y2="6"/>
                    <line x1="3" x2="21" y1="10" y2="10"/>
                    <path d="m9 16 2 2 4-4"/>
                  </svg>
                </div>
                <div className="customer-metric-card-value">{customersThisMonthLabel}</div>
                <div className="customer-metric-card-label">ลูกค้าในเดือนนี้</div>
              </div>
              
              {/* Latest Actions */}
              <div className="customer-sidebar-latest">
                <h3 className="customer-sidebar-latest-title">การดำเนินการล่าสุด</h3>
                <ul className="customer-sidebar-latest-list">
                  {recentActions.length ? (
                    recentActions.map((action) => (
                      <li key={action.id} className="customer-sidebar-latest-item">
                        <span className={`customer-sidebar-latest-dot customer-sidebar-latest-dot--${action.tone}`} />
                        <span>{action.label}</span>
                      </li>
                    ))
                  ) : (
                    <li className="customer-sidebar-latest-empty">ยังไม่มีการดำเนินการล่าสุด</li>
                  )}
                </ul>
              </div>
            </div>
          </aside>
        </div>

        {/* Customer List section */}
        <div className="customer-list-head-modern">
          <h2 className="customer-list-title-modern">รายชื่อลูกค้า</h2>
          <label className="customer-search-modern">
            <Icon name="search" className="customer-search-icon-modern h-4 w-4" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อบริษัท..."
            />
          </label>
        </div>

        <div className="customer-table-container-modern">
          <table className="customer-table-modern">
            <thead>
              <tr>
                <th>ชื่อบริษัท</th>
                <th>เลขประจำตัวผู้เสียภาษี</th>
                <th>ชื่อผู้ติดต่อ</th>
                <th>เบอร์ผู้ติดต่อ</th>
                <th style={{ textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {emptyState ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: "24px" }}>
                    {emptyState}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const display = customer.companyName.trim() || "(ไม่ระบุชื่อ)";
                  return (
                    <tr key={customer.id}>
                      <td style={{ fontWeight: 600 }}>{display}</td>
                      <td>{customer.taxId || "-"}</td>
                      <td>{customer.contactName || "-"}</td>
                      <td>{customer.contactPhone || "-"}</td>
                      <td>
                        <div className="customer-table-actions-modern" style={{ justifyContent: "center" }}>
                          <Link
                            className="customer-table-btn-select"
                            href={`/?customer=${encodeURIComponent(customer.id)}`}
                          >
                            เลือก
                          </Link>
                          <button
                            type="button"
                            className="customer-table-btn-edit"
                            onClick={() => beginEdit(customer)}
                          >
                            แก้ไข
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
      <div className="customer-mobile customer-mobile-stitch bg-background-light dark:bg-background-dark font-display antialiased text-text-primary-light dark:text-text-primary-dark h-screen overflow-hidden flex flex-col">
        <header className="flex-none bg-surface-light dark:bg-surface-dark shadow-sm z-10 sticky top-0 px-4 py-3 flex items-center justify-center border-b border-border-light dark:border-border-dark">
          <h1 className="text-lg font-bold tracking-tight text-center">
            ลงทะเบียนลูกค้า
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto no-scrollbar p-4 pb-40">
          <form id="customerFormMobile" onSubmit={onSubmit} className="space-y-6">
            <section className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-soft p-5 border border-transparent dark:border-border-dark">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <Icon name="person" className="h-5 w-5" />
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
                    E-mail
                  </label>
                  <input
                    className="w-full rounded-lg bg-background-light dark:bg-background-dark border border-gray-200 dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary text-base py-3 px-4 placeholder-gray-400"
                    type="email"
                    placeholder="example@company.com"
                    value={draft.contactEmail}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, contactEmail: e.target.value }))
                    }
                  />
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
          <section className="mt-6 space-y-3" id="listMobile">
            {loadError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                โหลดข้อมูลลูกค้าไม่สำเร็จ: {loadError}
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                รายชื่อลูกค้า
              </h2>
              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {loading ? "กำลังโหลด..." : `${filteredCustomers.length} รายการ`}
              </span>
            </div>
            {emptyState ? (
              <div className="rounded-xl border border-dashed border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {emptyState}
              </div>
            ) : null}
            {filteredCustomers.map((customer) => {
              const display = customer.companyName.trim() || "(ไม่ระบุชื่อ)";
              const secondary = [customer.contactName, customer.contactPhone, customer.contactEmail]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={customer.id}
                  className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4 shadow-soft"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {display}
                    </div>
                    {secondary ? (
                      <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        {secondary}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Link
                      href={`/?customer=${encodeURIComponent(customer.id)}`}
                      className="blob-button product-action-button inline-flex w-full items-center justify-center"
                    >
                      <span className="blob-button__text">เลือก</span>
                      <span className="blob-button__inner" aria-hidden="true">
                        <span className="blob-button__blobs">
                          <span className="blob-button__blob" />
                          <span className="blob-button__blob" />
                          <span className="blob-button__blob" />
                          <span className="blob-button__blob" />
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="blob-button product-action-button inline-flex w-full items-center justify-center"
                      onClick={() => beginEdit(customer)}
                    >
                      <span className="blob-button__text">แก้ไข</span>
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
                </div>
              );
            })}
          </section>
        </main>
        <footer className="app-bottom-nav-spacer fixed left-0 w-full bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark p-4 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] z-20">
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
              className="flex-1 py-3.5 px-4 rounded-lg font-bold text-white bg-primary hover:bg-primary-dark shadow-[0_10px_20px_rgba(116,16,16,0.3)] transition-all transform active:scale-[0.98]"
            >
              {saving ? "กำลังบันทึก…" : editingCustomerId ? "อัปเดตลูกค้า" : "บันทึกลูกค้า"}
            </button>
          </div>
        </footer>
        <BottomNav items={visibleMenuItems} activeHref={activeHref} />
      </div>
    </main>
  );
}
