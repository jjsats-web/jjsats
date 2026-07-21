"use client";

import AppHeader from "@/components/AppHeader";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import swal from "sweetalert";
import jjsatsLogo from "@/public/jjsats-logo.png";
import BottomNav from "@/components/BottomNav";
import { type IconName } from "@/components/Icon";
import LineItemsTable, { LineItem } from "@/components/LineItemsTable";
import { usePinRole } from "@/components/PinRoleProvider";
import QuoteForm, { QuoteFormData } from "@/components/QuoteForm";
import { formatCurrency, formatCurrencyPlain } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  sku: string;
  dealerPrice: number;
  projectPrice: number;
  userPrice: number;
};

type QuoteItem = {
  description: string;
  qty: number;
  price: number;
};

type QuoteHistoryItem = {
  id: string;
  companyName: string;
  systemName: string;
  items: QuoteItem[];
  total: number;
  createdAt: string;
  customerId: string | null;
  note: string | null;
};

type CustomerInfo = {
  companyName: string;
  taxId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  approxPurchaseDate: string;
};

type PinProfile = {
  firstName: string;
  lastName: string;
  role: "admin" | "user";
  signatureImage: string;
};

type MenuItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  prefetch?: boolean;
};

type PriceTier = "dealer" | "project" | "user";
type PriceTierSelection = PriceTier | "";
type SwalIcon = "success" | "error" | "warning" | "info" | "question";
type ApprovalRequestStatus = "approved" | "pending";

const HISTORY_PREVIEW_COUNT = 3;
const NOTE_STORAGE_KEY = "quoteNote";

const initialForm: QuoteFormData = {
  companyName: "",
  systemName: "",
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeQuoteItems(rawItems: unknown): QuoteItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        description: readString(record.description),
        qty: Math.max(0, readNumber(record.qty)),
        price: Math.max(0, readNumber(record.price)),
      };
    })
    .filter((item) => item.description && item.qty > 0);
}

function normalizeQuoteRecord(record: Record<string, unknown>): QuoteHistoryItem | null {
  const id = readString(record.id);
  if (!id) return null;

  return {
    id,
    companyName: readString(record.company_name),
    systemName: readString(record.system_name),
    items: normalizeQuoteItems(record.items),
    total: Math.max(0, readNumber(record.total)),
    createdAt: readString(record.created_at),
    customerId: readOptionalString(record.customer_id),
    note: readOptionalString(record.note),
  };
}

function formatQuoteNumber(id: string) {
  const digits = id.replace(/\D/g, "");
  return digits || id;
}

function formatQuoteDate(value: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}



function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadImageDataUrl(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageClient />
    </Suspense>
  );
}

function HomePageClient() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customer");
  const productSearchRef = useRef<HTMLInputElement | null>(null);
  const customProductRef = useRef<HTMLInputElement | null>(null);
  const priceTierRef = useRef<HTMLSelectElement | null>(null);
  const [form, setForm] = useState<QuoteFormData>(initialForm);
  const [items, setItems] = useState<LineItem[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [note, setNote] = useState("");
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [customProductInput, setCustomProductInput] = useState("");
  const [customPriceInput, setCustomPriceInput] = useState("0");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState("");
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingPriceTier, setPendingPriceTier] = useState<PriceTierSelection>("");
  const [quoteHistory, setQuoteHistory] = useState<QuoteHistoryItem[]>([]);
  const [quoteHistoryError, setQuoteHistoryError] = useState("");
  const [quoteHistoryLoading, setQuoteHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { role, setRole } = usePinRole();
  const [pinProfile, setPinProfile] = useState<PinProfile>({
    firstName: "",
    lastName: "",
    role: "user",
    signatureImage: "",
  });

  const activeHref = "/";
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
  const visibleMenuItems =
    role === "admin" ? menuItems : menuItems.filter((item) => !item.adminOnly);

  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [approvalStatusById, setApprovalStatusById] = useState<
    Record<string, ApprovalRequestStatus>
  >({});

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

  const getProductPriceByTier = useCallback((product: Product, tier: PriceTier) => {
    if (tier === "dealer") return Number(product.dealerPrice || 0);
    if (tier === "project") return Number(product.projectPrice || 0);
    return Number(product.userPrice || 0);
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsError("");
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = (await res.json()) as Product[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) {
        const message = !res.ok && "error" in data && typeof data.error === "string" ? data.error : "";
        setProductsError(message || "โหลดรายการสินค้าไม่สำเร็จ");
        return;
      }
      setProducts(data);
    } catch {
      setProductsError("เกิดข้อผิดพลาดในการโหลดสินค้า");
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    try {
      const storedNote = localStorage.getItem(NOTE_STORAGE_KEY);
      if (storedNote !== null) {
        setNote(storedNote);
      }
    } catch {
      // ignore storage errors
    } finally {
      setNoteLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!noteLoaded) return;
    try {
      localStorage.setItem(NOTE_STORAGE_KEY, note);
    } catch {
      // ignore storage errors
    }
  }, [note, noteLoaded]);

  const loadQuoteHistory = useCallback(async () => {
    setQuoteHistoryError("");
    setQuoteHistoryLoading(true);
    try {
      const res = await fetch("/api/quotes", { cache: "no-store" });
      const data = (await res.json()) as unknown;
      if (!res.ok || !Array.isArray(data)) {
        const message =
          !res.ok &&
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "โหลดประวัติใบเสนอราคาไม่สำเร็จ";
        setQuoteHistoryError(message);
        setQuoteHistory([]);
        return;
      }

      const normalized = data
        .map((record) => normalizeQuoteRecord(record as Record<string, unknown>))
        .filter((record): record is QuoteHistoryItem => Boolean(record));
      setQuoteHistory(normalized);
    } catch {
      setQuoteHistoryError("เกิดข้อผิดพลาดในการโหลดประวัติใบเสนอราคา");
    } finally {
      setQuoteHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuoteHistory();
  }, [loadQuoteHistory]);

  useEffect(() => {
    if (!quoteHistory.length) return;
    let cancelled = false;
    const ids = quoteHistory.map((quote) => quote.id).filter(Boolean);
    if (!ids.length) return;

    const loadApprovalStatuses = async () => {
      try {
        const res = await fetch(`/api/quote-approvals?ids=${encodeURIComponent(ids.join(","))}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          statuses?: Record<
            string,
            { status?: string | null; requested_at?: string | null }
          >;
        };
        if (!res.ok || !data || typeof data !== "object") return;

        const nextStatuses: Record<string, ApprovalRequestStatus> = {};
        const records = data.statuses ?? {};
        for (const [quoteId, record] of Object.entries(records)) {
          const status = typeof record?.status === "string" ? record.status : "";
          if (status === "approved" || status === "pending") {
            nextStatuses[quoteId] = status;
          }
        }

        if (!cancelled && Object.keys(nextStatuses).length) {
          setApprovalStatusById((prev) => ({ ...prev, ...nextStatuses }));
        }
      } catch {
        // ignore status fetch errors
      }
    };

    void loadApprovalStatuses();
    const intervalId = window.setInterval(loadApprovalStatuses, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [quoteHistory]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/pin", { cache: "no-store" });
        const data = (await res.json()) as {
          firstName?: string;
          lastName?: string;
          role?: string;
          signatureImage?: string;
          error?: string;
        };
        if (!res.ok || !data || "error" in data) return;
        const role = data.role === "admin" ? "admin" : "user";
        setPinProfile({
          firstName: data.firstName?.trim() ?? "",
          lastName: data.lastName?.trim() ?? "",
          role,
          signatureImage: data.signatureImage?.trim() ?? "",
        });
        setRole(role);
      } catch {
        // ignore
      }
    };
    void loadProfile();
  }, [setRole]);

  useEffect(() => {
    if (!customerId) return;

    let cancelled = false;
    const loadCustomer = async () => {
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as unknown;
        if (cancelled) return;
        if (!res.ok || !data || typeof data !== "object") return;
        if ("error" in data) return;

        const record = data as Record<string, unknown>;

        setForm((prev) => ({
          ...prev,
          companyName: typeof record.companyName === "string" ? record.companyName : "",
          systemName: typeof record.systemName === "string" ? record.systemName : "",
        }));
      } catch {
        // Ignore transient errors
      }
    };

    void loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term),
    );
  }, [products, search]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Math.max(item.qty * item.price, 0), 0);
    const discount = Math.max(0, readNumber(discountInput));
    const appliedDiscount = Math.min(discount, subtotal);
    return { subtotal, discount: appliedDiscount, total: subtotal - appliedDiscount };
  }, [items, discountInput]);

  const quoteHistoryStatus = useMemo(() => {
    if (quoteHistoryLoading) return "กำลังโหลดประวัติใบเสนอราคา…";
    if (!quoteHistory.length && !quoteHistoryError) return "ยังไม่มีประวัติใบเสนอราคา";
    return "";
  }, [quoteHistoryError, quoteHistoryLoading, quoteHistory.length]);

  const handleFormChange = (patch: Partial<QuoteFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleItemChange = <K extends keyof LineItem>(
    id: string,
    field: K,
    value: LineItem[K],
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const getProductDescription = (product: Product) =>
    `${product.sku || "SKU"} - ${product.name}`;

  const getPriceTierLabel = (tier: PriceTier) => {
    if (tier === "dealer") return "Dealer";
    if (tier === "project") return "Project";
    return "User";
  };

  const handleChooseProduct = (product: Product) => {
    setPendingProduct(product);
    setSearch("");
    setTimeout(() => priceTierRef.current?.focus(), 0);
  };

  const handleChoosePriceTier = (nextTier: PriceTierSelection) => {
    setPendingPriceTier(nextTier);
  };

  const addPendingSelection = () => {
    if (!pendingProduct) {
      productSearchRef.current?.focus();
      return;
    }
    if (!pendingPriceTier) {
      priceTierRef.current?.focus();
      return;
    }

    const price = getProductPriceByTier(pendingProduct, pendingPriceTier);
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: getProductDescription(pendingProduct),
        qty: 1,
        price,
        locked: true,
      },
    ]);
    setPendingProduct(null);
    setPendingPriceTier("");
    productSearchRef.current?.focus();
  };

  const addCustomItem = () => {
    const description = customProductInput.trim();
    if (!description) {
      customProductRef.current?.focus();
      return;
    }
    const price = Math.max(0, readNumber(customPriceInput));
    setItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        description,
        qty: 1,
        price,
      },
    ]);
    setCustomProductInput("");
    setCustomPriceInput("0");
    customProductRef.current?.focus();
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.companyName || !form.systemName) {
      await showModal("กรุณาเลือกลูกค้าจากหน้า “ทะเบียนลูกค้า” ก่อน", "warning");
      return;
    }
    if (!items.length) {
      await showModal("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ", "warning");
      productSearchRef.current?.focus();
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          companyName: form.companyName,
          systemName: form.systemName,
          items,
          discount: totals.discount,
          note: note.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        await showModal(data?.error || "เกิดข้อผิดพลาดในการบันทึกใบเสนอราคา", "error");
        return;
      }
      await showModal("บันทึกใบเสนอราคาเรียบร้อย", "success");
      void loadQuoteHistory();
    } catch {
      await showModal("เกิดข้อผิดพลาดในการบันทึกใบเสนอราคา", "error");
    } finally {
      setSaving(false);
    }
  };

  const requestQuoteApproval = async (
    quote: QuoteHistoryItem,
  ): Promise<ApprovalRequestStatus | null> => {
    try {
      const res = await fetch("/api/quote-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        requested?: boolean;
        retryAfterSeconds?: number;
        error?: string;
      };

      if (!res.ok || !data || typeof data.status !== "string") {
        const message =
          data && "error" in data && typeof data.error === "string"
            ? data.error
            : "ส่งคำขออนุมัติไม่สำเร็จ";
        await showModal(message, "error");
        return null;
      }

      if (data.status === "approved") return "approved";
      if (data.status === "pending") {
        await showModal("ขออนุมัติแล้ว", "info");
        return "pending";
      }

      await showModal("ไม่สามารถตรวจสอบสถานะการอนุมัติได้", "error");
      return null;
    } catch {
      await showModal("เกิดข้อผิดพลาดในการส่งคำขออนุมัติ", "error");
      return null;
    }
  };

  const handleRequestApproval = async (quote: QuoteHistoryItem) => {
    if (approvalBusyId === quote.id) return;
    setApprovalBusyId(quote.id);

    const status = await requestQuoteApproval(quote);
    if (status) {
      setApprovalStatusById((prev) => ({ ...prev, [quote.id]: status }));
    }
    setApprovalBusyId(null);
  };

  const exportQuotePdf = async (quote: QuoteHistoryItem) => {
    if (approvalStatusById[quote.id] !== "approved") {
      await showModal("ต้องได้รับการอนุมัติก่อนดาวโหลด", "warning");
      return;
    }

    let customerInfo: CustomerInfo | null = null;
    if (quote.customerId) {
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(quote.customerId)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (res.ok && data && !("error" in data)) {
          customerInfo = {
            companyName: readString(data.companyName),
            taxId: readString(data.taxId),
            contactName: readString(data.contactName),
            contactPhone: readString(data.contactPhone),
            contactEmail: readString(data.contactEmail),
            address: readString(data.address),
            approxPurchaseDate: readString(data.approxPurchaseDate),
          };
        }
      } catch {
        customerInfo = null;
      }
    }

    const logoAssetPath = typeof jjsatsLogo === "string" ? jjsatsLogo : jjsatsLogo.src;
    const logoAssetUrl = new URL(logoAssetPath, window.location.origin).toString();
    const logoUrl = await loadImageDataUrl(logoAssetUrl);
    const quoteNumber = formatQuoteNumber(quote.id);
    const quoteRef = quote.id.toUpperCase().startsWith("QT") ? quote.id : quoteNumber;
    const quoteDate = (() => {
      if (!quote.createdAt) return "-";
      const parsed = new Date(quote.createdAt);
      if (Number.isNaN(parsed.getTime())) return "-";
      return parsed.toLocaleDateString("th-TH", { dateStyle: "short" });
    })();
    const customerName = customerInfo?.companyName || quote.companyName || "-";
    const customerAddress = customerInfo?.address || "-";
    const attentionName = customerInfo?.contactName || customerName;
    const attentionPhone = customerInfo?.contactPhone ? customerInfo.contactPhone : "";
    const attentionLine = [attentionName, attentionPhone ? `(${attentionPhone})` : ""]
      .filter(Boolean)
      .join(" ");
    const customerTaxId = customerInfo?.taxId ? customerInfo.taxId : "-";
    const subjectLine = quote.systemName
      ? `ใบเสนอราคา ${quote.systemName}`
      : "";
    const salesSignatureName = [pinProfile.firstName, pinProfile.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const salesName = salesSignatureName || "-";
    const signatureImage = pinProfile.signatureImage?.startsWith("data:image/")
      ? pinProfile.signatureImage
      : "";
    const salesSignatureCaption = salesSignatureName
      ? `(${escapeHtml(salesSignatureName)})`
      : "( )";
    const salesPhone = "0619926993";
    const salesEmail = "sales@jjsat.co.th";
    const noteContent = quote.note?.trim() || "-";

    const subtotal = quote.items.reduce(
      (sum, item) => sum + Math.max(item.qty * item.price, 0),
      0,
    );
    const discount = Math.max(subtotal - Math.max(quote.total, 0), 0);
    const discountedSubtotal = Math.max(subtotal - discount, 0);
    const vat = discountedSubtotal * 0.07;
    const grandTotal = discountedSubtotal + vat;
    const discountDisplay = discount > 0 ? -discount : 0;

    const splitItemDescription = (description: string) => {
      const parts = description.split(" - ");
      if (parts.length >= 2) {
        const sku = parts.shift()?.trim() ?? "";
        const name = parts.join(" - ").trim();
        return { sku: sku || "-", description: name || "-" };
      }
      return { sku: "-", description };
    };

    const itemsRows = quote.items
      .map((item, index) => {
        const lineTotal = Math.max(item.qty * item.price, 0);
        const { sku, description } = splitItemDescription(item.description);
        return `
          <tr>
            <td class="seq">${index + 1}</td>
            <td class="sku">${sku !== "-" ? escapeHtml(sku) : ""}</td>
            <td class="desc">${escapeHtml(description)}</td>
            <td class="qty">${item.qty}</td>
            <td class="price">${formatCurrencyPlain(item.price)}</td>
            <td class="amount">${formatCurrencyPlain(lineTotal)}</td>
          </tr>
        `;
      })
      .join("");

    const itemsTable = quote.items.length
      ? `
        <table class="items">
          <thead>
            <tr>
              <th class="seq">ลำดับ</th>
              <th class="sku">รหัสสินค้า</th>
              <th class="desc">รายละเอียด</th>
              <th class="qty">จำนวน</th>
              <th class="price">ราคา</th>
              <th class="amount">เป็นเงิน</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
      `
      : `<div class="empty">ไม่มีรายการสินค้า</div>`;

    const html = `
      <!doctype html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>ใบเสนอราคา</title>
          <style>
            @page { size: A4; margin: 0; }
            * { box-sizing: border-box; font-weight: normal; }
            body { font-family: "TH Sarabun New", "Sarabun", "Noto Sans Thai", "Segoe UI", sans-serif; color: #000000; margin: 0; }
            .doc {
              width: 210mm;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              gap: 8px;
              padding: 8mm 14mm 10mm;
              background: #ffffff;
            }
            .doc-header {
              display: flex;
              align-items: center;
              gap: 16px;
              padding-bottom: 2px;
            }
            .doc-header::after {
              content: "";
              width: 120px;
              flex-shrink: 0;
            }
            .logo {
              width: 110px;
              flex-shrink: 0;
            }
            .logo img {
              width: 100%;
              height: auto;
              display: block;
            }
            .company {
              flex: 1;
              text-align: center;
              line-height: 1.35;
              padding: 0 4px;
            }
            .company-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 1px;
              color: #000000;
            }
            .company-detail {
              font-size: 12.5px;
              line-height: 1.25;
              color: #000000;
            }
            .company-detail--line2 {
              font-size: 12.5px;
              white-space: nowrap;
              display: inline-block;
              max-width: 100%;
              margin: 0 auto;
            }
            .tax-id-nowrap {
              white-space: nowrap;
            }
            .company-detail + .company-detail {
              margin-top: 1px;
            }
            .doc-title {
              text-align: center;
              font-size: 19px;
              font-weight: bold;
              letter-spacing: 0.12em;
              margin-top: -6px;
              margin-bottom: 2px;
              color: #000000;
            }
            .quote-box {
              display: grid;
              grid-template-columns: 1.7fr 1fr;
              border: 1px solid #000000;
              font-size: 13px;
            }
            .quote-box__col {
              padding: 2px 12px 10px;
            }
            .quote-box__col + .quote-box__col {
              border-left: 1px solid #000000;
            }
            .quote-row {
              display: grid;
              grid-template-columns: 130px 1fr;
              gap: 8px;
              padding: 2px 0;
              margin-bottom: 0;
              align-items: start;
              line-height: 1.38;
            }
            .quote-box__col--right .quote-row {
              grid-template-columns: 100px 1fr;
            }
            .quote-label {
              white-space: nowrap;
              font-weight: bold;
              line-height: 1.38;
              color: #000000;
            }
            .quote-value {
              line-height: 1.38;
              color: #000000;
            }
            .intro {
              margin-top: 2px;
              margin-bottom: 2px;
              font-size: 13px;
              line-height: 1.35;
              color: #000000;
            }
            .items {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #000000;
            }
            .items th,
            .items td {
              border-bottom: 1px solid #000000;
              border-right: 1px solid #000000;
              font-size: 13px;
            }
            .items th:last-child,
            .items td:last-child {
              border-right: none;
            }
            .items th {
              background: #f3f4f6;
              color: #000000;
              text-align: center;
              vertical-align: middle;
              padding: 8px 6px 6px;
              font-weight: bold;
              height: auto;
              line-height: 1.4;
            }
            .items td {
              padding: 4px 6px 8px;
              text-align: left;
              vertical-align: top;
              line-height: 1.38;
              background: #ffffff;
            }
            .items th.seq,
            .items td.seq {
              text-align: center;
              width: 40px;
            }
            .items th.sku {
              text-align: center;
              width: 110px;
            }
            .items td.sku {
              text-align: left;
              width: 110px;
              vertical-align: top;
            }
            .items th.desc {
              text-align: center;
            }
            .items td.desc {
              text-align: left;
              vertical-align: top;
            }
            .items th.qty,
            .items td.qty {
              text-align: center;
              width: 50px;
            }
            .items th.price {
              text-align: center;
              width: 90px;
            }
            .items td.price {
              text-align: right;
              width: 90px;
            }
            .items th.amount {
              text-align: center;
              width: 100px;
            }
            .items td.amount {
              text-align: right;
              width: 100px;
            }
            .summary {
              display: flex;
              justify-content: flex-end;
              position: relative;
              z-index: 1;
              margin-top: -8px;
            }
            .summary table {
              border-collapse: collapse;
              width: 190px;
              min-width: 190px;
              margin-top: 0;
              border: 1px solid #000000;
              border-top: 1px solid #000000;
            }
            .summary td {
              padding: 6px 8px 8px;
              font-size: 13px;
              line-height: 1.4;
              border-bottom: 1px solid #000000;
              border-right: 1px solid #000000;
              background: #ffffff;
            }
            .summary td:last-child {
              border-right: none;
            }
            .summary tr:last-child td {
              border-bottom: none;
            }
            .summary td.label {
              color: #000000;
              text-align: right;
              padding-right: 12px;
              width: 90px;
            }
            .summary td.value {
              text-align: right;
              width: 100px;
              min-width: 100px;
            }
            .summary td.label.grand,
            .summary td.value.grand {
              font-weight: bold;
            }
            .note {
              margin-top: 6px;
              font-size: 12.5px;
              border: none;
              padding: 0;
            }
            .note-title {
              margin-bottom: 2px;
              font-weight: bold;
              color: #000000;
            }
            .note-body {
              white-space: pre-line;
              color: #000000;
              line-height: 1.25;
            }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              border: 1px solid #000000;
              margin-top: auto;
              min-height: 100px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .signature-box {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 10px 14px;
              text-align: center;
              font-size: 13px;
              color: #000000;
              box-sizing: border-box;
            }
            .signature-box--seller {
              border-right: 1px solid #000000;
            }
            .signature-image {
              display: block;
              max-width: 150px;
              max-height: 42px;
              height: 42px;
              margin-bottom: 2px;
              object-fit: contain;
            }
            .signature-line-empty {
              height: 42px;
              width: 150px;
              margin-bottom: 2px;
              border-bottom: 1px solid #000000;
            }
            .signature-name {
              font-size: 13px;
              margin-top: 2px;
              color: #000000;
            }
            .signature-title {
              font-size: 12px;
              color: #555555;
              margin-top: 1px;
            }
            .signature-approval-title {
              font-size: 13px;
              font-weight: bold;
              margin-bottom: 12px;
              color: #000000;
            }
            .signature-line-dots {
              font-size: 13px;
              color: #000000;
              margin-bottom: 4px;
            }
            .signature-approval-caption {
              font-size: 11px;
              color: #555555;
              line-height: 1.3;
              max-width: 260px;
              margin: 0 auto;
            }
            .empty {
              color: #94a3b8;
              margin-top: 8px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="doc">
            <header class="doc-header">
              <div class="logo">
                <img src="${logoUrl}" alt="JJSATs Technology" />
              </div>
              <div class="company">
                <div class="company-name">บริษัท เจเจแซท เทคโนโลยี จำกัด</div>
                <div class="company-detail">54/52 ม.8 ถ.พุทธมณฑลสาย 5 ต.บางกระทึก อ.สามพราน จ.นครปฐม 73210</div>
                <div class="company-detail company-detail--line2">โทร: 061-992-6993,096-823-4431 อีเมล: sales@jjsats.co.th,rungruengh@jjsats.co.th <span class="tax-id-nowrap">เลขประจำตัวผู้เสียภาษี 0105554023435</span></div>
              </div>
            </header>

            <div class="doc-title">ใบเสนอราคา</div>

            <section class="quote-box">
              <div class="quote-box__col">
                <div class="quote-row">
                  <div class="quote-label">ผู้ซื้อ:</div>
                  <div class="quote-value">${escapeHtml(customerName)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">เรียน:</div>
                  <div class="quote-value">${escapeHtml(attentionLine || "-")}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">เรื่อง:</div>
                  <div class="quote-value">${escapeHtml(subjectLine)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">ที่อยู่:</div>
                  <div class="quote-value">${escapeHtml(customerAddress)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">เลขประจำตัวผู้เสียภาษี:</div>
                  <div class="quote-value">${escapeHtml(customerTaxId)}</div>
                </div>
              </div>
              <div class="quote-box__col quote-box__col--right">
                <div class="quote-row">
                  <div class="quote-label">ใบเสนอราคาเลขที่:</div>
                  <div class="quote-value">${escapeHtml(quoteRef)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">วันที่:</div>
                  <div class="quote-value">${escapeHtml(quoteDate)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">พนักงานขาย:</div>
                  <div class="quote-value">${escapeHtml(salesName)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">โทรศัพท์:</div>
                  <div class="quote-value">${escapeHtml(salesPhone)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">อีเมล:</div>
                  <div class="quote-value">${escapeHtml(salesEmail)}</div>
                </div>
              </div>
            </section>

            <div class="intro">
              บริษัทฯ ขอขอบคุณที่ท่านให้ความไว้วางใจในการเลือกใช้ บริการ หรือ ผลิตภัณฑ์ ของบริษัทฯ และมีความยินดีที่จะเสนอราคาและเงื่อนไขดังต่อไปนี้
            </div>

            ${itemsTable}

            <div class="summary">
              <table>
                <tr>
                  <td class="label">รวมเป็นเงิน</td>
                  <td class="value">${formatCurrencyPlain(subtotal)}</td>
                </tr>
                ${
                  discount > 0
                    ? `
                <tr>
                  <td class="label">ส่วนลด</td>
                  <td class="value">${formatCurrencyPlain(discountDisplay)}</td>
                </tr>
                    `
                    : ""
                }
                <tr>
                  <td class="label">ภาษีมูลค่าเพิ่ม 7%</td>
                  <td class="value">${formatCurrencyPlain(vat)}</td>
                </tr>
                <tr>
                  <td class="label grand">ราคาสุทธิ</td>
                  <td class="value grand">${formatCurrencyPlain(grandTotal)}</td>
                </tr>
              </table>
            </div>

            <section class="note">
              <div class="note-title">ข้อเสนอและเงื่อนไข</div>
              <div class="note-body">${escapeHtml(noteContent)}</div>
            </section>

            <div class="signatures">
              <div class="signature-box signature-box--seller">
                ${
                  signatureImage
                    ? `<img class="signature-image" src="${signatureImage}" alt="ลายเซ็น" />`
                    : `<div class="signature-line-empty"></div>`
                }
                <div class="signature-name">${salesSignatureCaption}</div>
                <div class="signature-title">พนักงานขาย</div>
              </div>
              <div class="signature-box signature-box--buyer">
                <div class="signature-approval-title">พิจารณาตกลงจัดซื้อจัดจ้าง</div>
                <div class="signature-line-dots">
                  ลงชื่อ ...........................................................
                </div>
                <div class="signature-approval-caption">
                  ผู้อำนาจลงนามเพื่อยืนยันการจัดซื้อจัดจ้าง พร้อมตราประทับ (ถ้ามี)
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "794px";
    iframe.style.height = "1123px";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const cleanup = () => {
      iframe.remove();
    };

    try {
      const iframeWindow = iframe.contentWindow;
      const iframeDoc = iframeWindow?.document;
      if (!iframeWindow || !iframeDoc) {
        cleanup();
        void showModal("ไม่สามารถสร้างเอกสารได้ กรุณาลองใหม่", "error");
        return;
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      if (iframeDoc.readyState !== "complete") {
        await new Promise<void>((resolve) => {
          iframe.addEventListener("load", () => resolve(), { once: true });
        });
      }

      if (iframeDoc.fonts?.ready) {
        try {
          await iframeDoc.fonts.ready;
        } catch {
          // ignore font errors
        }
      }

      const images = Array.from(iframeDoc.images);
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
        }),
      );

      const target = iframeDoc.querySelector(".doc") as HTMLElement | null;
      if (!target) {
        cleanup();
        void showModal("ไม่พบเนื้อหาใบเสนอราคา", "error");
        return;
      }

      const signatures = iframeDoc.querySelector(".signatures") as HTMLElement | null;
      if (signatures) {
        const targetRect = target.getBoundingClientRect();
        const signatureRect = signatures.getBoundingClientRect();
        const pageWidth = targetRect.width || target.scrollWidth || 794;
        const pageHeightPx = Math.round((pageWidth * 297) / 210);
        const offsetTop = signatureRect.top - targetRect.top;
        const blockHeight = signatureRect.height;
        const pageBottom = Math.ceil((offsetTop + 1) / pageHeightPx) * pageHeightPx;
        const safety = 24;
        if (offsetTop + blockHeight + safety > pageBottom) {
          const spacer = iframeDoc.createElement("div");
          spacer.style.height = `${pageBottom - offsetTop + safety}px`;
          signatures.parentElement?.insertBefore(spacer, signatures);
        }
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const targetWidth = target.getBoundingClientRect().width || target.scrollWidth || 794;
      const renderScale = Math.min(6, Math.max(3.5, 3300 / targetWidth));
      const canvas = await html2canvas(target, {
        backgroundColor: "#fff",
        scale: renderScale,
        useCORS: true,
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 0;
      const printableWidth = pdfWidth;
      const imgHeight = (canvas.height * printableWidth) / canvas.width;
      const pageHeight = pdfHeight;
      const pageTolerance = 0.5;
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, printableWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > pageTolerance) {
        pdf.addPage();
        position = margin - (imgHeight - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, printableWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const pdfBlob = pdf.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      cleanup();
      const newTab = window.open(pdfUrl, "_blank");
      if (newTab) {
        newTab.opener = null;
      }
    } catch (error) {
      cleanup();
      const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
      void showModal(message || "เกิดข้อผิดพลาด", "error");
    }
    };

  return (
    <main className="pt-16 pb-24 lg:pb-0 quote-page">
      <AppHeader items={visibleMenuItems} activeHref={activeHref} />

      <div className="container">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {pinProfile.firstName || pinProfile.lastName ? (
            <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              คุณ {`${pinProfile.firstName} ${pinProfile.lastName}`.trim()}
            </div>
          ) : null}
          <h1>สร้างใบเสนอราคา JJSATs</h1>
        </div>

        <form id="quoteForm" onSubmit={onSubmit} className="quote-form">
          <section className="quote-section">
            <QuoteForm
              value={form}
              onChange={handleFormChange}
              companyDisabled
              systemDisabled={!customerId}
            />
          </section>

          <section className="quote-section">
            <div
              className="catalog-bar"
              style={{ flexDirection: "column", alignItems: "stretch" }}
            >
            <div
              style={{
                width: "100%",
                display: "flex",
                gap: "1rem",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div className="catalog-bar__field catalog-bar__field--full">
                <label htmlFor="productSearch">ค้นหา (ชื่อ/รหัส)</label>
                <input
                  id="productSearch"
                  type="text"
                  ref={productSearchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="พิมพ์ตัวเลขหรืออักษรเพื่อค้นหา"
                />
                <div className="catalog-bar__helper">
                  {productsError ? (
                    <span className="catalog-bar__helper-text catalog-bar__helper-text--error">
                      {productsError}
                    </span>
                  ) : (
                    <span className="catalog-bar__helper-text" aria-hidden="true">
                      &nbsp;
                    </span>
                  )}
                </div>
                <div
                  className={`product-results ${filteredProducts.length ? "is-visible" : ""}`}
                >
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="product-result"
                      onClick={() => {
                        handleChooseProduct(product);
                      }}
                    >
                      <span>
                        <strong>{product.sku || "ไม่มีรหัส"}</strong> — {product.name}
                      </span>
                      <span className="product-result__price">
                        ยอดรวม
                      </span>
                    </button>
                  ))}
                </div>
                {pendingProduct ? (
                  <div style={{ marginTop: ".35rem", color: "var(--muted)" }}>
                    เลือกสินค้าแล้ว:{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {getProductDescription(pendingProduct)}
                    </strong>
                    {pendingPriceTier ? (
                      <>
                        {" "}
                        | ราคา:{" "}
                        <strong style={{ color: "var(--text)" }}>
                          {getPriceTierLabel(pendingPriceTier)}{" "}
                          {formatCurrency(getProductPriceByTier(pendingProduct, pendingPriceTier))}
                        </strong>
                        {" "}
                        (กด “เลือกสินค้า” เพื่อเพิ่มลงรายการ)
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="catalog-bar__actions" style={{ alignItems: "flex-end" }}>
                <div
                  className="catalog-bar__tier"
                >
                  <label htmlFor="priceTier" style={{ color: "var(--muted)", fontWeight: 600 }}>
                    ราคา
                  </label>
                  <select
                    id="priceTier"
                    ref={priceTierRef}
                    value={pendingPriceTier}
                    onChange={(e) =>
                      handleChoosePriceTier(e.target.value as PriceTierSelection)
                    }
                  >
                    <option value="" disabled>
                      เลือกประเภทราคา
                    </option>
                    <option value="dealer">
                      Dealer —{" "}
                      {pendingProduct
                        ? formatCurrency(getProductPriceByTier(pendingProduct, "dealer"))
                        : "—"}
                    </option>
                    <option value="project">
                      Project —{" "}
                      {pendingProduct
                        ? formatCurrency(getProductPriceByTier(pendingProduct, "project"))
                        : "—"}
                    </option>
                    <option value="user">
                      User —{" "}
                      {pendingProduct
                        ? formatCurrency(getProductPriceByTier(pendingProduct, "user"))
                        : "—"}
                    </option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addPendingSelection}
                  className="ghost catalog-bar__action-button"
                >
                  + เลือกสินค้า
                </button>
              </div>
            </div>
            <div
              style={{
                width: "100%",
                display: "flex",
                gap: "1rem",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div className="catalog-bar__field catalog-bar__field--full">
                <label htmlFor="customProduct">สินค้าอื่นๆ (ชื่อ/รหัส)</label>
                <input
                  id="customProduct"
                  type="text"
                  ref={customProductRef}
                  value={customProductInput}
                  onChange={(e) => setCustomProductInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomItem();
                    }
                  }}
                  placeholder="พิมพ์ชื่อหรือรหัสสินค้าที่ไม่มีในระบบ"
                />
              </div>
              <div className="catalog-bar__actions" style={{ alignItems: "flex-end" }}>
                <div
                  className="catalog-bar__tier"
                >
                  <label htmlFor="customPrice" style={{ color: "var(--muted)", fontWeight: 600 }}>
                    ราคา
                  </label>
                  <input
                    id="customPrice"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={customPriceInput}
                    onChange={(e) => setCustomPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomItem();
                      }
                    }}
                    placeholder="0.00"
                  />
                </div>
                <button
                  type="button"
                  className="ghost catalog-bar__action-button"
                  onClick={addCustomItem}
                >
                  + เพิ่มสินค้าอื่นๆ
                </button>
              </div>
            </div>
            </div>
          </section>

          <section className="quote-section">
            <h2>รายการสินค้า</h2>
            <LineItemsTable
              items={items}
              onChangeItem={handleItemChange}
              onRemoveItem={removeItem}
            />
          </section>

          <section className="quote-section">
            <div className="totals">
              <div className="totals__row">
                ยอดรวมรายการ: <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <label className="totals__row totals__discount">
                <span>ส่วนลด:</span>
                <input
                  id="discount"
                  name="discount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
              </label>
              <div className="totals__row">
                <strong>
                  รวมทั้งสิ้น: <span>{formatCurrency(totals.total)}</span>
                </strong>
              </div>
            </div>

            <div className="form-block">
              <div className="row">
                <label htmlFor="quoteNote">หมายเหตุ</label>
                <textarea
                  id="quoteNote"
                  name="quoteNote"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น ระยะเวลาส่งมอบ, เงื่อนไขเพิ่มเติม"
                />
              </div>
            </div>

            <div className="actions center quote-actions">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-bold text-white shadow-[0_10px_20px_rgba(116,16,16,0.3)] transition-all transform hover:bg-primary-dark active:scale-[0.98]"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกใบเสนอราคา"}
              </button>
            </div>
          </section>
        </form>

        <section id="history" className="quote-section">
          <h2>ประวัติใบเสนอราคา</h2>
          {quoteHistoryError ? (
            <div style={{ color: "#b91c1c", marginBottom: ".6rem" }}>
              {quoteHistoryError}
            </div>
          ) : null}
          {quoteHistoryStatus ? (
            <div style={{ color: "var(--muted)", marginBottom: ".6rem" }}>
              {quoteHistoryStatus}
            </div>
          ) : null}
          <div className="quote-history">
            {quoteHistory.map((quote) => {
              const previewItems = quote.items.slice(0, HISTORY_PREVIEW_COUNT);
              const remainingCount = quote.items.length - previewItems.length;
              const isApprovalPending = approvalBusyId === quote.id;
              const approvalStatus = approvalStatusById[quote.id];
              const isApproved = approvalStatus === "approved";
              const isPendingApproval = approvalStatus === "pending";
              const actionLabel = isApproved
                ? "ดาวโหลด"
                : isApprovalPending
                  ? "กำลังส่งคำขอ..."
                  : isPendingApproval
                    ? "ขออนุมัติใหม่"
                    : "ขออนุมัติ";
              return (
                <div key={quote.id} className="quote-history__card">
                  <div className="quote-history__main">
                    <div className="quote-history__title">
                      ใบเสนอราคาเลขที่ {formatQuoteNumber(quote.id)}
                    </div>
                    <div className="quote-history__subtitle">
                      {quote.companyName || "-"}
                    </div>
                    <div className="quote-history__meta">
                      <span>ระบบ: {quote.systemName || "-"}</span>
                      <span>วันที่: {formatQuoteDate(quote.createdAt)}</span>
                      <span>รายการ: {quote.items.length} รายการ</span>
                    </div>
                    <div className="quote-history__items">
                      {previewItems.length ? (
                        previewItems.map((item, index) => (
                          <div key={`${quote.id}-${index}`} className="quote-history__item">
                            <span>{item.description}</span>
                            <span>
                              {item.qty} x {formatCurrency(item.price)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="quote-history__item">
                          <span>ไม่มีรายการสินค้า</span>
                        </div>
                      )}
                    </div>
                    {remainingCount > 0 ? (
                      <div className="quote-history__more">
                        + อีก {remainingCount} รายการ
                      </div>
                    ) : null}
                  </div>
                  <div className="quote-history__side">
                    <div className="quote-history__total">
                      ยอดรวม
                      <strong>{formatCurrency(quote.total)}</strong>
                    </div>
                    <div className="quote-history__actions">
                      <button
                        type="button"
                        className={`quote-history__button blob-button${isApproved ? " quote-history__button--approved" : ""}`}
                        onClick={() =>
                          void (isApproved
                            ? exportQuotePdf(quote)
                            : handleRequestApproval(quote))
                        }
                        disabled={isApprovalPending}
                      >
                        <span className="blob-button__text">{actionLabel}</span>
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
                </div>
              );
            })}
          </div>
        </section>
        <div className="quote-mobile-actions">
          <button
            type="submit"
            form="quoteForm"
            disabled={saving}
            className="quote-mobile-actions__button inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3.5 font-bold text-white shadow-[0_10px_20px_rgba(116,16,16,0.3)] transition-all transform hover:bg-primary-dark active:scale-[0.98]"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกใบเสนอราคา"}
          </button>
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
      <BottomNav items={visibleMenuItems} activeHref={activeHref} />
    </main>
  );
}
