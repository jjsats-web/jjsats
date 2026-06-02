"use client";

import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import Icon, { type IconName } from "@/components/Icon";
import { usePinRole } from "@/components/PinRoleProvider";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type MenuItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  prefetch?: boolean;
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
  const { role, setRole } = usePinRole();
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const activeHref = "/product";
  const menuItems: MenuItem[] = [
    { id: "quote2", href: "/quotation", label: "เสนอราคา2", icon: "description" },
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
        const data = (await res.json()) as { role?: string; error?: string };
        if (!res.ok || !data || "error" in data) return;
        const role = data.role === "admin" ? "admin" : "user";
        setRole(role);
      } catch {
        // ignore
      }
    };
    void loadProfile();
  }, [setRole]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = (event?: MediaQueryListEvent) => {
      setIsMobile(event ? event.matches : media.matches);
    };
    update();
    if ("addEventListener" in media) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    const legacyMedia = media as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMedia.addListener?.(update);
    return () => legacyMedia.removeListener?.(update);
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

  const handleMobileChoose = (product: Product) => {
    startEdit(product);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      [p.name, p.sku, p.description].join(" ").toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const emptyText = useMemo(() => {
    if (!products.length && loading) return "กำลังโหลดรายการสินค้า…";
    if (searchTerm.trim() && !filteredProducts.length) return "ไม่พบสินค้าที่ค้นหา";
    if (!products.length) return "ยังไม่มีสินค้า";
    return "";
  }, [loading, products.length, filteredProducts.length, searchTerm]);

  return (
    <main className="product-admin-page pt-16 pb-24 lg:pb-0">
      <AppHeader items={visibleMenuItems} activeHref={activeHref} />

      <div className="product-admin-shell">
        <div className="product-admin-heading">
          <h1>คลังสินค้าบริษัท</h1>
        </div>
        <p className="product-admin-kicker" style={{ color: "#64748b", marginTop: "4px", marginBottom: "1.25rem" }}>
          เพิ่มสินค้ามาตรฐานไว้ใช้ดึงเข้าหน้าใบเสนอราคาได้ทันที
        </p>

        <form
          id="productForm"
          onSubmit={onSubmit}
          className="product-admin-form"
          ref={formRef}
        >
          <div className="product-admin-form__grid">
            <div className="product-admin-field">
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
            <div className="product-admin-field">
              <label htmlFor="productSku">รหัส/SKU</label>
              <input
                id="productSku"
                type="text"
                value={draft.sku}
                onChange={(e) => setDraft((prev) => ({ ...prev, sku: e.target.value }))}
                placeholder="ถ้ามี"
              />
            </div>
            <div className="product-admin-field">
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

          <div className="product-admin-form__grid">
            <div className="product-admin-field">
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
            <div className="product-admin-field">
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
            <div className="product-admin-field">
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

          <div className="product-admin-form__grid">
            <div className="product-admin-field product-admin-field--full">
              <label htmlFor="productDescription">
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
          </div>

          <div className="product-admin-form__actions">
            {editingId ? (
              <button type="button" className="product-admin-cancel" onClick={resetForm}>
                ยกเลิกการแก้ไข
              </button>
            ) : null}
            <button type="submit" disabled={saving} className="product-admin-submit">
              {editingId ? "อัปเดตสินค้า" : "บันทึกสินค้า"}
            </button>
          </div>

          {saveError ? (
            <div className="product-admin-error">{saveError}</div>
          ) : null}
        </form>

        <div className="product-admin-list-head">
          <h2>รายการสินค้าบริษัท</h2>
          <label className="product-admin-search">
            <Icon name="search" className="h-4 w-4" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า/รหัส..."
            />
          </label>
        </div>

        {loadError ? (
          <div className="product-admin-error">{loadError}</div>
        ) : null}

        {isMobile ? (
          <div className="product-mobile-list">
            {emptyText ? (
              <div className="product-mobile-empty">{emptyText}</div>
            ) : (
              filteredProducts.map((product) => (
                <div key={product.id} className="product-mobile-card">
                  <div className="product-mobile-card__name">{product.name}</div>
                  <div className="product-mobile-card__actions">
                    <button
                      type="button"
                      className="ghost-link"
                      onClick={() => handleMobileChoose(product)}
                    >
                      แก้ไข
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="product-admin-table-wrap">
            <table className="product-admin-table" id="productTable">
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
                    <td colSpan={5} className="product-admin-table__empty">
                      {emptyText}
                    </td>
                  </tr>
                ) : null}
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div>
                        <strong>{product.name}</strong>
                      </div>
                      <div className="product-admin-card__meta" style={{ color: "#64748b", fontSize: ".9rem" }}>
                        {product.description || ""}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: ".15rem" }}>
                        <div>
                          Dealer: {priceFormatter.format(Number(product.dealerPrice || 0))}
                        </div>
                        <div>
                          Project: {priceFormatter.format(Number(product.projectPrice || 0))}
                        </div>
                        <div>User: {priceFormatter.format(Number(product.userPrice || 0))}</div>
                      </div>
                    </td>
                    <td>{product.unit || "-"}</td>
                    <td>{product.sku || "-"}</td>
                    <td>
                      <div className="product-admin-row-actions">
                        <button
                          type="button"
                          className="product-admin-icon-button"
                          onClick={() => startEdit(product)}
                          aria-label={`แก้ไข ${product.name}`}
                          title="แก้ไข"
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="product-admin-icon-button product-admin-icon-button--danger"
                          onClick={() => void onDelete(product.id)}
                          disabled={saving}
                          aria-label={`ลบ ${product.name}`}
                          title="ลบ"
                        >
                          <Icon name="delete" className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
      <BottomNav items={visibleMenuItems} activeHref={activeHref} />
    </main>
  );
}
