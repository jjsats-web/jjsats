"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import swal from "sweetalert";
import LineItemsTable, { LineItem } from "@/components/LineItemsTable";
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
  address: string;
  approxPurchaseDate: string;
};

type PinProfile = {
  firstName: string;
  lastName: string;
  role: "admin" | "user";
  signatureImage: string;
};

type PriceTier = "dealer" | "project" | "user";
type PriceTierSelection = PriceTier | "";
type SwalIcon = "success" | "error" | "warning" | "info" | "question";
type ApprovalRequestStatus = "approved" | "pending";

const HISTORY_PREVIEW_COUNT = 3;
const NOTE_STORAGE_KEY = "quoteNote";
const APPROVAL_COOLDOWN_MS = 10 * 60 * 1000;

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

function getCooldownRemainingMs(requestedAt: string | null) {
  if (!requestedAt) return 0;
  const timestamp = Date.parse(requestedAt);
  if (Number.isNaN(timestamp)) return 0;
  const elapsed = Date.now() - timestamp;
  return Math.max(0, APPROVAL_COOLDOWN_MS - elapsed);
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
  const [pinProfile, setPinProfile] = useState<PinProfile>({
    firstName: "",
    lastName: "",
    role: "user",
    signatureImage: "",
  });

  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [approvalStatusById, setApprovalStatusById] = useState<
    Record<string, ApprovalRequestStatus>
  >({});
  const [approvalRequestedAtById, setApprovalRequestedAtById] = useState<
    Record<string, string>
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
        const nextRequestedAt: Record<string, string> = {};
        const records = data.statuses ?? {};
        for (const [quoteId, record] of Object.entries(records)) {
          const status = typeof record?.status === "string" ? record.status : "";
          const requestedAt =
            typeof record?.requested_at === "string" ? record.requested_at : "";
          if (status === "approved" || status === "pending") {
            nextStatuses[quoteId] = status;
          }
          if (requestedAt) {
            nextRequestedAt[quoteId] = requestedAt;
          }
        }

        if (!cancelled && Object.keys(nextStatuses).length) {
          setApprovalStatusById((prev) => ({ ...prev, ...nextStatuses }));
        }
        if (!cancelled && Object.keys(nextRequestedAt).length) {
          setApprovalRequestedAtById((prev) => ({ ...prev, ...nextRequestedAt }));
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
        setPinProfile({
          firstName: data.firstName?.trim() ?? "",
          lastName: data.lastName?.trim() ?? "",
          role: data.role === "admin" ? "admin" : "user",
          signatureImage: data.signatureImage?.trim() ?? "",
        });
      } catch {
        // ignore
      }
    };
    void loadProfile();
  }, []);

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
        const retryAfterSeconds =
          typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : 0;
        if (data.requested) {
          setApprovalRequestedAtById((prev) => ({
            ...prev,
            [quote.id]: new Date().toISOString(),
          }));
        }
        const message = data.requested
          ? "ส่งคำขออนุมัติแล้ว กรุณารอการอนุมัติ"
          : retryAfterSeconds > 0
            ? `ยังไม่ครบเวลา สามารถขอใหม่ได้อีก ${Math.ceil(retryAfterSeconds / 60)} นาที`
            : "มีคำขออนุมัติอยู่แล้ว กรุณารอการอนุมัติ";
        await showModal(message, "info");
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
            address: readString(data.address),
            approxPurchaseDate: readString(data.approxPurchaseDate),
          };
        }
      } catch {
        customerInfo = null;
      }
    }

    const logoUrl = await loadImageDataUrl(`${window.location.origin}/jjsats-logo.png`);
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
    const salesSignatureLine = signatureImage
      ? `<img class="signature-image" src="${signatureImage}" alt="ลายเซ็น" />`
      : `<div class="signature-line"></div>`;
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
      .map((item) => {
        const lineTotal = Math.max(item.qty * item.price, 0);
        const { sku, description } = splitItemDescription(item.description);
        return `
          <tr>
            <td class="code">${escapeHtml(sku)}</td>
            <td>${escapeHtml(description)}</td>
            <td class="num">${item.qty}</td>
            <td class="num">${formatCurrencyPlain(item.price)}</td>
            <td class="num">${formatCurrencyPlain(lineTotal)}</td>
          </tr>
        `;
      })
      .join("");

    const itemsTable = quote.items.length
      ? `
        <table class="items">
          <thead>
            <tr>
              <th class="code"><div class="th-cell">รหัสสินค้า</div></th>
              <th><div class="th-cell">รายละเอียด</div></th>
              <th class="num"><div class="th-cell">จำนวน/Unit</div></th>
              <th class="num"><div class="th-cell">ราคา/Price</div></th>
              <th class="num"><div class="th-cell">รวม</div></th>
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
            * { box-sizing: border-box; }
            body { font-family: "Kanit", "Noto Sans Thai", "Segoe UI", sans-serif; color: #0b1224; margin: 0; }
            .doc {
              width: 210mm;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              gap: 18px;
              padding: 8mm 16mm 18mm;
            }
            .doc-header {
              display: flex;
              align-items: center;
              gap: 16px;
              padding-bottom: 12px;
              border-bottom: none;
            }
            .doc-header::after {
              content: "";
              width: 120px;
              flex-shrink: 0;
            }
            .logo {
              width: 120px;
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
              line-height: 1.5;
            }
            .company-name {
              font-weight: 700;
              font-size: 16px;
              margin-bottom: 4px;
            }
            .company-detail {
              font-size: 12px;
              color: #334155;
            }
            .company-detail + .company-detail {
              margin-top: 2px;
            }
            .doc-title {
              text-align: center;
              font-size: 18px;
              font-weight: 700;
              letter-spacing: 0.08em;
              margin-top: -18px;
            }
            .quote-box {
              display: grid;
              grid-template-columns: 1.8fr 1fr;
              border: 1px solid #111827;
              font-size: 10px;
              margin-top: -6px;
            }
            .quote-box__col {
              padding: 8px 20px 12px;
            }
            .quote-box__col + .quote-box__col {
              border-left: 1px solid #111827;
            }
            .quote-row {
              display: grid;
              grid-template-columns: 160px 1fr;
              gap: 4px;
              padding: 1px 0;
              align-items: start;
            }
            .quote-label {
              font-weight: 600;
              white-space: nowrap;
            }
            .quote-value {
              line-height: 1.35;
            }
            .intro {
              margin-top: -4px;
              margin-bottom: -4px;
              font-size: 10px;
              line-height: 1.4;
            }
            .intro + .items,
            .intro + .empty {
              margin-top: -6px;
            }
            .items {
              width: 100%;
              border-collapse: collapse;
              margin-top: 0;
            }
            .quote-box + .items,
            .quote-box + .empty {
              margin-top: -8px;
            }
            .items th,
            .items td {
              padding: 10px 8px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 11px;
            }
            .items th {
              background: #741010;
              color: #fff;
              font-weight: 700;
              text-align: center;
              vertical-align: middle;
              height: 36px;
              padding: 0 8px;
              overflow: visible;
              font-size: 10px;
            }
            .items thead th {
              text-align: center;
              vertical-align: middle;
            }
            .items thead th .th-cell {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100%;
              line-height: 1.1;
              transform: translateY(-6px);
              white-space: nowrap;
              text-align: center;
            }
            .items th.num {
              text-align: center;
            }
            .items th.code {
              text-align: center;
              width: 70px;
            }
            .items td {
              text-align: left;
              font-size: 10px;
            }
            .items tbody tr:nth-child(even) td {
              background: #fef2f2;
            }
            .items td.code {
              text-align: center;
              white-space: nowrap;
              font-size: 9px;
            }
            .items td.num {
              text-align: center;
              white-space: nowrap;
            }
            .summary {
              display: flex;
              justify-content: flex-end;
              margin-top: 0;
            }
            .items + .summary,
            .empty + .summary {
              margin-top: -8px;
            }
            .summary table {
              border-collapse: collapse;
              min-width: 260px;
            }
            .summary td {
              padding: 4px 0;
              font-size: 11px;
            }
            .summary td.label {
              color: #64748b;
              text-align: right;
              padding-right: 12px;
            }
            .summary td.value {
              text-align: right;
              min-width: 110px;
            }
            .summary .grand {
              font-weight: 700;
              color: #7a1717;
              position: relative;
              padding-top: 4px;
            }
            .summary .grand::before {
              content: "";
              position: absolute;
              top: 2px;
              left: 0;
              right: 0;
              border-top: 2px solid #7a1717;
            }
            .note {
              margin-top: 10px;
              font-size: 10px;
            }
            .note-title {
              font-weight: 700;
              margin-bottom: 4px;
            }
            .note-body {
              white-space: pre-line;
              color: #0f172a;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 26px;
              gap: 20px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .signature {
              flex: 1;
              text-align: center;
              font-size: 10px;
              color: #64748b;
            }
            .signature--approval {
              color: #1f2937;
            }
            .signature-approval-title {
              font-weight: 600;
              margin-bottom: 8px;
            }
            .signature-approval-line {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
              margin-bottom: 6px;
            }
            .signature-approval-line .label {
              white-space: nowrap;
            }
            .signature-approval-line .line {
              border-bottom: 1px dotted #94a3b8;
              width: 180px;
              height: 16px;
            }
            .signature-approval-caption {
              color: #64748b;
              font-size: 9px;
              line-height: 1.4;
              margin: 0 auto;
              max-width: 220px;
            }
            .signature-image {
              display: block;
              max-width: 140px;
              max-height: 60px;
              margin: 0 auto 6px;
              object-fit: contain;
            }
            .signature-line {
              border-bottom: 1px solid #94a3b8;
              margin: 0 auto 6px;
              width: 70%;
              height: 18px;
            }
            .signature-name {
              margin-top: 2px;
              font-weight: 600;
              color: #1f2937;
            }
            .empty { color: #94a3b8; margin-top: 8px; font-size: 11px; }
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
                <div class="company-detail">
                  54/52 ม.8 ถ.พุทธมณฑลสาย 5 ต.บางกระทึก อ.สามพราน จ.นครปฐม 73210 
                </div>
                <div class="company-detail">
                  โทร: 061-992-6993, 096-823-4431 อีเมล: sales@jjsats.co.th, rungruengh@jjsats.co.th
                  เลขประจำตัวผู้เสียภาษี 0105554023435
                </div>
              </div>
            </header>

            <div class="doc-title">QUOTATION</div>

            <section class="quote-box">
              <div class="quote-box__col">
                <div class="quote-row">
                  <div class="quote-label">ลูกค้า/Customer:</div>
                  <div class="quote-value">${escapeHtml(customerName)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">เรียน/ATTN:</div>
                  <div class="quote-value">${escapeHtml(attentionLine || "-")}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">เรื่อง/Topic:</div>
                  <div class="quote-value">${escapeHtml(subjectLine)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">ที่อยู่/Address:</div>
                  <div class="quote-value">${escapeHtml(customerAddress)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">เลขประจำตัวผู้เสียภาษี (TaxID):</div>
                  <div class="quote-value">${escapeHtml(customerTaxId)}</div>
                </div>
              </div>
              <div class="quote-box__col">
                <div class="quote-row">
                  <div class="quote-label">ใบเสนอราคาเลขที่/No.</div>
                  <div class="quote-value">${escapeHtml(quoteRef)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">วันที่/Issue:</div>
                  <div class="quote-value">${escapeHtml(quoteDate)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">พนักงานขาย/Issuer:</div>
                  <div class="quote-value">${escapeHtml(salesName)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">โทรศัพท์/Tel:</div>
                  <div class="quote-value">${escapeHtml(salesPhone)}</div>
                </div>
                <div class="quote-row">
                  <div class="quote-label">อีเมล/E-mail:</div>
                  <div class="quote-value">${escapeHtml(salesEmail)}</div>
                </div>
              </div>
            </section>

            <div class="intro">
              บริษัทฯ ขอขอบคุณที่ท่านให้ความไว้วางใจในการเลือกใช้ บริการ หรือ ผลิตภัณฑ์ ของบรืษัทฯ และมีความยินดีที่จะเสนอราคาและเงื่อนไขดังต่อไปนี้
              
            </div>

            ${itemsTable}

            <div class="summary">
              <table>
                <tr>
                  <td class="label">ยอดรวม</td>
                  <td class="value">${formatCurrencyPlain(subtotal)}</td>
                </tr>
                <tr>
                  <td class="label">ยอดรวม</td>
                  <td class="value">${formatCurrencyPlain(discountDisplay)}</td>
                </tr>
                <tr>
                  <td class="label">ภาษีมูลค่าเพิ่ม (7%)</td>
                  <td class="value">${formatCurrencyPlain(vat)}</td>
                </tr>
                <tr>
                  <td class="label grand">ยอดรวมสุทธิ</td>
                  <td class="value grand">${formatCurrencyPlain(grandTotal)}</td>
                </tr>
              </table>
            </div>

            <section class="note">
              <div class="note-title">ข้อเสนอและเงื่อนไข</div>
              <div class="note-body">${escapeHtml(noteContent)}</div>
            </section>

            <div class="signatures">
              <div class="signature">
                ${salesSignatureLine}
                <div class="signature-name">${salesSignatureCaption}</div>
                <div>พนักงานขาย/Issuer</div>
              </div>
              <div class="signature signature--approval">
                <div class="signature-approval-title">พิจารณาตกลงจัดซื้อจัดจ้าง</div>
                <div class="signature-approval-line">
                  <span class="label">ลงชื่อ</span>
                  <span class="line"></span>
                </div>
                <div class="signature-approval-caption">
                  ผู้มีอำนาจลงนามเพื่อยืนยันการจัดซื้อจัดจ้าง พร้อมตราประทับ (ถ้ามี)
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
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, printableWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
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
    <main>
      <header className="topbar">
        <div className="topbar__brand">JJSATs Quotation</div>
        <nav>
          <Link href="/" className="active">
            ใบเสนอราคา
          </Link>
          <Link href="/customer">ทะเบียนลูกค้า</Link>
          {pinProfile.role === "admin" ? (
            <>
              <Link href="/product">สินค้าบริษัท</Link>
              <Link href="/pin/register">ลงทะเบียน</Link>
              <Link href="/pin/manage">จัดการ PIN</Link>
            </>
          ) : null}
          <Link href="/logout">ออกจากระบบ</Link>
        </nav>
      </header>

      <div className="container">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {pinProfile.firstName || pinProfile.lastName ? (
            <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              คุณ {`${pinProfile.firstName} ${pinProfile.lastName}`.trim()}
            </div>
          ) : null}
          <h1>สร้างใบเสนอราคา JJSATs</h1>
        </div>

        <form onSubmit={onSubmit} className="quote-form">
          <QuoteForm
            value={form}
            onChange={handleFormChange}
            companyDisabled
            systemDisabled={!customerId}
          />

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
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ".3rem",
                    minWidth: "220px",
                    flex: "0 0 220px",
                  }}
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
                  className="ghost"
                  onClick={addPendingSelection}
                  style={{ width: "200px" }}
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
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ".3rem",
                    minWidth: "220px",
                    flex: "0 0 220px",
                  }}
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
                  className="ghost"
                  onClick={addCustomItem}
                  style={{ width: "200px" }}
                >
                  + เพิ่มสินค้าอื่นๆ
                </button>
              </div>
            </div>
          </div>

          <h2>ประวัติใบเสนอราคา</h2>
          <LineItemsTable
            items={items}
            onChangeItem={handleItemChange}
            onRemoveItem={removeItem}
          />

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

          <div className="actions center">
            <button type="submit" disabled={saving} className="blob-button">
              <span className="blob-button__text">
                {saving ? "กำลังบันทึก..." : "บันทึกใบเสนอราคา"}
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

        <section id="history">
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
              const approvalRequestedAt = approvalRequestedAtById[quote.id] ?? null;
              const cooldownRemainingMs = isPendingApproval
                ? getCooldownRemainingMs(approvalRequestedAt)
                : 0;
              const cooldownMinutes =
                cooldownRemainingMs > 0 ? Math.ceil(cooldownRemainingMs / 60000) : 0;
              const canRequestAgain = !isPendingApproval || cooldownRemainingMs <= 0;
              const actionLabel = isApproved
                ? "ดาวโหลด"
                : isApprovalPending
                  ? "กำลังส่งคำขอ..."
                  : isPendingApproval
                    ? cooldownRemainingMs > 0
                      ? `รออีก ${cooldownMinutes} นาที`
                      : "ขออนุมัติใหม่"
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
                        disabled={isApprovalPending || !canRequestAgain}
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
    </main>
  );
}
