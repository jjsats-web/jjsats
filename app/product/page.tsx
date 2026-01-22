"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import swal from "sweetalert";

type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  dealerPrice: number;
  projectPrice: number;
  userPrice: number;
  description: string;
};

type ProductDraft = {
  name: string;
  sku: string;
  unit: string;
  dealerPrice: string;
  projectPrice: string;
  userPrice: string;
  description: string;
};
type PinProfile = { firstName: string; lastName: string; role: "admin" | "user" };
type MenuItem = {
  id: string;
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
};
type SwalIcon = "success" | "error" | "warning" | "info" | "question";

const API = "/api/products";

const initialDraft: ProductDraft = {
  name: "",
  sku: "",
  unit: "",
  dealerPrice: "",
  projectPrice: "",
  userPrice: "",
  description: "",
};

function normalizeText(value: string) {
  return value.trim();
}

function parsePrice(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

const priceFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ProductPage() {
  const [draft, setDraft] = useState<ProductDraft>(initialDraft);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pinProfile, setPinProfile] = useState<PinProfile>({
    firstName: "",
    lastName: "",
    role: "user",
  });

  const activeHref = "/product";
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

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(API, { cache: "no-store" });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setLoadError("โหลดข้อมูลไม่สำเร็จ (response ไม่ใช่ JSON)");
        return;
      }

      if (!res.ok) {
        const message =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : "เกิดข้อผิดพลาด";
        setLoadError(message);
        return;
      }

      if (!Array.isArray(data)) {
        setLoadError("รูปแบบข้อมูลไม่ถูกต้อง");
        return;
      }

      setProducts(data as Product[]);
    } catch {
      setLoadError("เกิดข้อผิดพลาดในการโหลดรายการสินค้า");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

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

  const resetForm = () => {
    setDraft(initialDraft);
    setEditingId("");
    setSaveError("");
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setDraft({
      name: product.name ?? "",
      sku: product.sku ?? "",
      unit: product.unit ?? "",
      dealerPrice: Number.isFinite(product.dealerPrice) ? String(product.dealerPrice) : "",
      projectPrice: Number.isFinite(product.projectPrice) ? String(product.projectPrice) : "",
      userPrice: Number.isFinite(product.userPrice) ? String(product.userPrice) : "",
      description: product.description ?? "",
    });
    document.getElementById("productName")?.focus();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError("");

    const payload = {
      name: normalizeText(draft.name),
      sku: normalizeText(draft.sku),
      unit: normalizeText(draft.unit),
      dealerPrice: parsePrice(draft.dealerPrice),
      projectPrice: parsePrice(draft.projectPrice),
      userPrice: parsePrice(draft.userPrice),
      description: normalizeText(draft.description),
    };

    if (!payload.name) {
      const message = "กรุณาระบุชื่อสินค้า";
      setSaveError(message);
      await showModal(message, "warning");
      return;
    }

    const wasEditing = Boolean(editingId);
    setSaving(true);
    try {
      const url = editingId ? `${API}/${editingId}` : API;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        const message = "บันทึกไม่สำเร็จ (response ไม่ใช่ JSON)";
        setSaveError(message);
        await showModal(message, "error");
        return;
      }

      const errorMessage =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : "";

      if (!res.ok || errorMessage) {
        const message = errorMessage || "เกิดข้อผิดพลาด";
        setSaveError(message);
        await showModal(message, "error");
        return;
      }

      const saved = data as Product;
      setProducts((prev) =>
        editingId
          ? prev.map((product) => (product.id === saved.id ? saved : product))
          : [saved, ...prev],
      );
      resetForm();
      await loadProducts();
      await showModal(wasEditing ? "อัปเดตข้อมูลสินค้าแล้ว" : "บันทึกข้อมูลสินค้าแล้ว", "success");
    } catch {
      const message = "เกิดข้อผิดพลาด";
      setSaveError(message);
      await showModal(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    const ok = confirm("ต้องการลบสินค้านี้หรือไม่?");
    if (!ok) return;

    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${API}/${id}`, { method: "DELETE" });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        const message = "ลบไม่สำเร็จ (response ไม่ใช่ JSON)";
        setSaveError(message);
        await showModal(message, "error");
        return;
      }
      const errorMessage =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : "";

      if (!res.ok || errorMessage) {
        const message = errorMessage || "เกิดข้อผิดพลาด";
        setSaveError(message);
        await showModal(message, "error");
        return;
      }
      setProducts((prev) => prev.filter((product) => product.id !== id));
      if (editingId === id) resetForm();
      await loadProducts();
    } catch {
      const message = "เกิดข้อผิดพลาด";
      setSaveError(message);
      await showModal(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const emptyText = useMemo(() => {
    if (!products.length && loading) return "กำลังโหลดรายการสินค้า…";
    if (!products.length) return "ยังไม่มีสินค้า";
    return "";
  }, [loading, products.length]);

  return (
    <main className="pb-24 lg:pb-0">
      <header className="topbar">
        <div className="topbar__brand">JJSATs Quotation</div>
      </header>

      <div className="container">
        <h1>คลังสินค้าบริษัท</h1>
        <p style={{ color: "#64748b", marginTop: "-.5rem", marginBottom: "1rem" }}>
          เพิ่มสินค้ามาตรฐานไว้ใช้ดึงเข้าหน้าใบเสนอราคาได้ทันที
        </p>

        <form id="productForm" onSubmit={onSubmit} style={{ marginBottom: "1.2rem" }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div>
              <label htmlFor="productName">ชื่อสินค้า*</label>
              <input
                id="productName"
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="เช่น กล้องวงจรปิด 4MP"
              />
            </div>
            <div>
              <label htmlFor="productSku">รหัส/SKU</label>
              <input
                id="productSku"
                type="text"
                value={draft.sku}
                onChange={(e) => setDraft((prev) => ({ ...prev, sku: e.target.value }))}
                placeholder="ถ้ามี"
              />
            </div>
            <div>
              <label htmlFor="productUnit">หน่วย</label>
              <input
                id="productUnit"
                type="text"
                value={draft.unit}
                onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="เช่น ชุด, กล้อง, กล่อง"
              />
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div>
              <label htmlFor="productDealerPrice">Dealer</label>
              <input
                id="productDealerPrice"
                type="number"
                step="0.01"
                min={0}
                value={draft.dealerPrice}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, dealerPrice: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="productProjectPrice">Project</label>
              <input
                id="productProjectPrice"
                type="number"
                step="0.01"
                min={0}
                value={draft.projectPrice}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, projectPrice: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="productUserPrice">User</label>
              <input
                id="productUserPrice"
                type="number"
                step="0.01"
                min={0}
                value={draft.userPrice}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, userPrice: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="row" style={{ flexDirection: "column", gap: ".4rem" }}>
            <label style={{ minWidth: 0 }} htmlFor="productDescription">
              รายละเอียด
            </label>
            <textarea
              id="productDescription"
              rows={3}
              value={draft.description}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="รายละเอียดสั้นๆ"
            />
          </div>

          <div className="actions center">
            {editingId ? (
              <button type="button" className="ghost-link" onClick={resetForm}>
                ยกเลิกการแก้ไข
              </button>
            ) : null}
            <button type="submit" disabled={saving} className="blob-button">
              <span className="blob-button__text">
                {editingId ? "อัปเดตสินค้า" : "บันทึกสินค้า"}
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

          {saveError ? (
            <div style={{ marginTop: ".65rem", color: "#b91c1c" }}>{saveError}</div>
          ) : null}
        </form>

        <h2>รายการสินค้าบริษัท</h2>
        {loadError ? (
          <div style={{ marginBottom: ".75rem", color: "#b91c1c" }}>{loadError}</div>
        ) : null}
        <table className="table" id="productTable">
          <thead>
            <tr>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>หน่วย</th>
              <th>รหัส</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {emptyText ? (
              <tr>
                <td
                  colSpan={5}
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
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <div>
                    <strong>{product.name}</strong>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: ".9rem" }}>
                    {product.description || ""}
                  </div>
                </td>
                <td>
                  <div style={{ display: "grid", gap: ".15rem" }}>
                    <div>Dealer: {priceFormatter.format(Number(product.dealerPrice || 0))}</div>
                    <div>Project: {priceFormatter.format(Number(product.projectPrice || 0))}</div>
                    <div>User: {priceFormatter.format(Number(product.userPrice || 0))}</div>
                  </div>
                </td>
                <td>{product.unit || "-"}</td>
                <td>{product.sku || "-"}</td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: ".45rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="ghost-link"
                      style={{ border: "none", padding: ".45rem .7rem" }}
                      onClick={() => startEdit(product)}
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      className="remove"
                      style={{ border: "none", padding: ".45rem .7rem" }}
                      onClick={() => void onDelete(product.id)}
                      disabled={saving}
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              className={`flex flex-col items-center gap-1 ${
                isActive ? "text-primary" : "text-slate-400"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={`material-symbols-outlined text-[24px]${
                  isActive ? " font-bold" : ""
                }`}
              >
                {item.icon}
              </span>
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
