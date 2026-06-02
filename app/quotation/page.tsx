"use client";

import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import Icon, { type IconName } from "@/components/Icon";
import { usePinRole } from "@/components/PinRoleProvider";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatCurrencyPlain } from "@/lib/format";
import swal from "sweetalert";

type MenuItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  prefetch?: boolean;
};

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

type QuoteItem = {
  id: string;
  name: string;
  detail: string;
  qty: number;
  price: number;
  discount: number; // percentage
};

type SavedQuote = {
  id: string;
  customId?: string;
  date: string;
  customerName?: string;
  items: {
    description: string;
    qty: number;
    price: number;
  }[];
  itemsCount: number;
  total: number;
};

const QUOTE_NOTE_STORAGE_KEY = "quotation_note";

function createQuoteId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 version 4 UUID fallback for environments without randomUUID().
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function showJjsatsSuccessAlert(title: string, text: string) {
  return swal({
    title,
    text,
    icon: "success",
    className: "swal-jjsats-success",
    buttons: {
      confirm: {
        text: "ตกลง",
        value: true,
        visible: true,
        className: "swal-btn-jjsats",
        closeModal: true,
      },
    },
  });
}

function showJjsatsApprovalAlert() {
  return swal({
    title: "ส่งคำขออนุมัติสำเร็จ",
    icon: "success",
    content: {
      element: "div",
      attributes: {
        className: "swal-approval-card",
        innerHTML: `
          <div class="swal-approval-badge">Telegram approval request</div>
          <p class="swal-approval-copy">
            ระบบได้ส่งรายละเอียดใบเสนอราคาไปยัง Telegram ของผู้บริหารเรียบร้อยแล้ว
          </p>
          <div class="swal-approval-status">
            <span class="swal-approval-dot"></span>
            <span>รอผู้บริหารตรวจสอบและอนุมัติ</span>
          </div>
        `,
      },
    },
    className: "swal-jjsats-success swal-jjsats-approval",
    buttons: {
      confirm: {
        text: "ตกลง",
        value: true,
        visible: true,
        className: "swal-btn-jjsats",
        closeModal: true,
      },
    },
  });
}

const menuItems: MenuItem[] = [
  { id: "quote2", href: "/quotation", label: "เสนอราคา2", icon: "description" },
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

export default function QuotationPage() {
  const { role } = usePinRole();
  const activeHref = "/quotation";
  const visibleMenuItems =
    role === "admin" ? menuItems : menuItems.filter((item) => !item.adminOnly);

  // --- Customer State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // --- Product State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);
  
  // --- Quote Items State ---
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  
  // --- Quote History & Modal State ---
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [approvalStatusById, setApprovalStatusById] = useState<Record<string, string>>({});
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [quoteNoteLoaded, setQuoteNoteLoaded] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    setQuoteNote(window.localStorage.getItem(QUOTE_NOTE_STORAGE_KEY) ?? "");
    setQuoteNoteLoaded(true);
  }, []);

  useEffect(() => {
    if (!quoteNoteLoaded) return;
    window.localStorage.setItem(QUOTE_NOTE_STORAGE_KEY, quoteNote);
  }, [quoteNote, quoteNoteLoaded]);

  // Load History from Supabase
  const loadQuoteHistory = useCallback(async () => {
    try {
      const pin = window.sessionStorage.getItem("pin_auth")?.trim() ?? "";
      const headers: Record<string, string> = pin ? { "x-pin-auth": pin } : {};
      const res = await fetch("/api/quotes", { headers, cache: "no-store" });
      const totalCountHeader = res.headers.get("x-total-count");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        const totalCount = totalCountHeader ? Number(totalCountHeader) : data.length;
        const rows = data as Array<{
          id: string;
          company_name?: string;
          items?: Array<{
            description?: unknown;
            qty?: unknown;
            price?: unknown;
          }>;
          total?: number;
          created_at?: string;
        }>;
        const mapped = rows.map((q, index) => {
          const dateStr = q.created_at
            ? new Date(q.created_at).toLocaleDateString("th-TH")
            : new Date().toLocaleDateString("th-TH");
          const items = Array.isArray(q.items)
            ? q.items.map((item) => ({
                description: typeof item.description === "string" ? item.description : "",
                qty: typeof item.qty === "number" ? item.qty : Number(item.qty) || 0,
                price: typeof item.price === "number" ? item.price : Number(item.price) || 0,
              }))
            : [];
          const itemsCount = items.length;
          const seqNum = totalCount - index + 47;
          const customId = `QUO-2026-${String(seqNum).padStart(3, "0")}`;
          return {
            id: q.id,
            customId,
            date: dateStr,
            customerName: q.company_name,
            items,
            itemsCount,
            total: Number(q.total || 0),
          };
        });
        setSavedQuotes(mapped);
      }
    } catch (error) {
      console.error("Failed to load quotes from Supabase:", error);
    }
  }, []);

  useEffect(() => {
    void loadQuoteHistory();
  }, [loadQuoteHistory]);

  // Poll approval statuses from Supabase API
  useEffect(() => {
    if (!savedQuotes.length) return;
    let cancelled = false;
    const ids = savedQuotes.map((q) => q.id).filter(Boolean);
    if (!ids.length) return;

    const loadApprovalStatuses = async () => {
      try {
        const pin = window.sessionStorage.getItem("pin_auth")?.trim() ?? "";
        const headers: Record<string, string> = pin ? { "x-pin-auth": pin } : {};
        const res = await fetch(`/api/quote-approvals?ids=${encodeURIComponent(ids.join(","))}`, {
          headers,
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || typeof data !== "object") return;

        const nextStatuses: Record<string, string> = {};
        const records = (data.statuses ?? {}) as Record<string, { status?: string }>;
        for (const [quoteId, record] of Object.entries(records)) {
          const status = record?.status || "";
          if (status === "approved" || status === "pending") {
            nextStatuses[quoteId] = status;
          }
        }

        if (!cancelled && Object.keys(nextStatuses).length) {
          setApprovalStatusById((prev) => ({ ...prev, ...nextStatuses }));
        }
      } catch {
        // ignore errors
      }
    };

    void loadApprovalStatuses();
    const intervalId = window.setInterval(loadApprovalStatuses, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [savedQuotes]);

  // Request approval through Supabase and Telegram API
  const handleRequestApproval = async (quoteId: string) => {
    if (approvalBusyId === quoteId) return;
    setApprovalBusyId(quoteId);

    const startTime = Date.now();

    try {
      const pin = window.sessionStorage.getItem("pin_auth")?.trim() ?? "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (pin) headers["x-pin-auth"] = pin;

      const res = await fetch("/api/quote-approvals", {
        method: "POST",
        headers,
        body: JSON.stringify({ quoteId }),
      });

      const data = await res.json().catch(() => ({}));
      
      // Calculate how long it took so we can keep the beautiful loader visible for at least 1200ms
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, 1200 - elapsed);
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }

      if (res.ok && data && data.status === "pending") {
        setApprovalStatusById((prev) => ({ ...prev, [quoteId]: "pending" }));
        await showJjsatsApprovalAlert();
      } else {
        await swal({
          title: "ส่งคำขออนุมัติไม่สำเร็จ",
          text: data.error || "เกิดข้อผิดพลาดในการส่งคำขออนุมัติ กรุณาลองใหม่อีกครั้ง",
          icon: "error",
          buttons: {
            confirm: {
              text: "ตกลง",
              className: "swal-btn-jjsats-error"
            }
          }
        });
      }
    } catch {
      await swal({
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถส่งคำขออนุมัติได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
        icon: "error",
        buttons: {
          confirm: {
            text: "ตกลง",
            className: "swal-btn-jjsats-error"
          }
        }
      });
    } finally {
      setApprovalBusyId(null);
    }
  };

  const exportQuotePdf = (quoteId: string) => {
    if (exportingId) return;
    setExportingId(quoteId);

    const iframe = document.createElement("iframe");
    iframe.src = `/approve/${quoteId}`;
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "1024px";
    iframe.style.height = "1448px";
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(async () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) throw new Error("Could not access iframe");

          const target = iframeDoc.querySelector(".quote-preview__page") as HTMLElement | null;
          if (!target) throw new Error("Could not find quote preview page");

          const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import("html2canvas"),
            import("jspdf"),
          ]);

          const canvas = await html2canvas(target, {
            backgroundColor: "#fff",
            scale: 3.0,
            useCORS: true,
            logging: false,
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
          
          document.body.removeChild(iframe);
          setExportingId(null);

          const newTab = window.open(pdfUrl, "_blank");
          if (newTab) {
            newTab.opener = null;
          }
        } catch (error) {
          try {
            document.body.removeChild(iframe);
          } catch {}
          setExportingId(null);
          console.error("PDF generation failed:", error);
          void swal("เกิดข้อผิดพลาด", "ไม่สามารถสร้างหรือดาวน์โหลดไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง", "error");
        }
      }, 800);
    };
  };

  // Fetch Customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const pin = window.sessionStorage.getItem("pin_auth")?.trim() ?? "";
        const headers: Record<string, string> = pin ? { "x-pin-auth": pin } : {};
        const res = await fetch("/api/customers", { headers, cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data)) {
          setCustomers(data);
        }
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      }
    };
    void fetchCustomers();
  }, []);

  // Fetch Products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      }
    };
    void fetchProducts();
  }, []);

  // Handle outside clicks for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(event.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
      if (
        productSearchRef.current &&
        !productSearchRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!searchCustomer.trim()) return customers;
    const lower = searchCustomer.toLowerCase();
    return customers.filter(
      (c) =>
        (c.companyName || "").toLowerCase().includes(lower) ||
        (c.taxId || "").includes(lower)
    );
  }, [customers, searchCustomer]);

  const filteredProducts = useMemo(() => {
    if (!searchProduct.trim()) return products;
    const lower = searchProduct.toLowerCase();
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(lower) ||
        (p.sku || "").toLowerCase().includes(lower)
    );
  }, [products, searchProduct]);

  const quoteTotals = useMemo(() => {
    return quoteItems.reduce(
      (totals, item) => {
        const lineTotal = item.qty * item.price;
        const lineDiscount = lineTotal * (item.discount / 100);
        return {
          subtotal: totals.subtotal + lineTotal,
          discount: totals.discount + lineDiscount,
          total: totals.total + lineTotal - lineDiscount,
        };
      },
      { subtotal: 0, discount: 0, total: 0 },
    );
  }, [quoteItems]);

  // Actions
  const confirmProductWithPrice = (product: Product, selectedPrice: number) => {
    const newItem: QuoteItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: product.name,
      detail: product.sku ? `SKU: ${product.sku}` : "",
      qty: 1,
      price: Number(selectedPrice || 0),
      discount: 0,
    };
    setQuoteItems((items) => [...items, newItem]);
    setPendingProduct(null);
  };

  const handleAddCustomProduct = () => {
    if (!customName.trim()) return;
    const priceNum = Number(customPrice);
    
    const newItem: QuoteItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: customName.trim(),
      detail: "เพิ่มเอง",
      qty: 1,
      price: isNaN(priceNum) ? 0 : priceNum,
      discount: 0,
    };
    setQuoteItems((items) => [...items, newItem]);
    setCustomName("");
    setCustomPrice("");
    setShowCustomForm(false);
  };

  const handleRemoveItem = (id: string) => {
    setQuoteItems((items) => items.filter((item) => item.id !== id));
  };

  const updateQuoteItem = (id: string, patch: Partial<QuoteItem>) => {
    setQuoteItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleDeleteQuote = async (quote: SavedQuote) => {
    if (deletingQuoteId) return;

    const confirmed = await swal({
      title: "ลบใบเสนอราคานี้?",
      text: `ต้องการลบ ${quote.customId || quote.id} ออกจากประวัติใบเสนอราคาหรือไม่`,
      icon: "warning",
      buttons: {
        cancel: {
          text: "ยกเลิก",
          value: false,
          visible: true,
          className: "swal-btn-jjsats-cancel",
          closeModal: true,
        },
        confirm: {
          text: "ลบรายการ",
          value: true,
          visible: true,
          className: "swal-btn-jjsats-error",
          closeModal: true,
        },
      },
      dangerMode: true,
    });

    if (!confirmed) return;

    setDeletingQuoteId(quote.id);
    try {
      const pin = window.sessionStorage.getItem("pin_auth")?.trim() ?? "";
      const headers: Record<string, string> = pin ? { "x-pin-auth": pin } : {};
      const res = await fetch(`/api/quotes/${encodeURIComponent(quote.id)}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        await swal("ลบไม่สำเร็จ", data.error || "เกิดข้อผิดพลาดในการลบใบเสนอราคา", "error");
        return;
      }

      setSavedQuotes((quotes) => quotes.filter((item) => item.id !== quote.id));
      setApprovalStatusById((prev) => {
        const next = { ...prev };
        delete next[quote.id];
        return next;
      });
    } catch {
      await swal("เกิดข้อผิดพลาด", "ไม่สามารถลบใบเสนอราคาได้ในขณะนี้", "error");
    } finally {
      setDeletingQuoteId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 lg:pb-0 overflow-x-hidden quote-page">
      <AppHeader items={visibleMenuItems} activeHref={activeHref} />

      <main className="pt-16 pb-24 lg:pb-0">
        <div className="quotation-page-shell">
          {/* Header Section */}
          <div className="quotation-page-heading">
            <h1>สร้างใบเสนอราคา</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-blue-100 text-primary font-mono px-3 py-1 rounded text-sm font-bold">
                QUO-2025-00045
              </span>
              <span className="text-slate-500 text-sm">• วันที่ 12 พ.ค. 2025</span>
            </div>
          </div>

        {/* Form Canvas */}
        <div className="flex flex-col gap-8">
          {/* Section 1: Customer */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-primary flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                    1
                  </span>
                  ลูกค้า
                </h2>
                <p className="text-slate-500 mt-1">เลือกจากลูกค้าที่มีอยู่ หรือเพิ่มใหม่</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1" ref={customerSearchRef}>
                <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 border-l-4 border-l-primary focus:ring-1 focus:ring-primary focus:bg-white transition-all rounded-lg"
                  placeholder="ค้นหาชื่อบริษัท หรือ เลขประจำตัวผู้เสียภาษี..."
                  type="text"
                  value={searchCustomer}
                  onChange={(e) => {
                    setSearchCustomer(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                
                {/* Autocomplete Dropdown */}
                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors flex flex-col gap-1"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setSearchCustomer("");
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <span className="font-semibold text-slate-900">{customer.companyName || "(ไม่ระบุชื่อ)"}</span>
                          {customer.taxId ? (
                            <span className="text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี: {customer.taxId}</span>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        ไม่พบข้อมูลลูกค้า
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Link href="/customer" className="px-6 py-3 border border-primary text-primary rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all">
                <Icon name="person_add" className="w-5 h-5" />
                เพิ่มลูกค้าใหม่
              </Link>
            </div>

            {selectedCustomer ? (
              <div className="bg-blue-50/50 border border-primary/20 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 flex-1">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        ชื่อบริษัท
                      </p>
                      <p className="font-bold text-lg text-slate-900">
                        {selectedCustomer.companyName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        เลขประจำตัวผู้เสียภาษี
                      </p>
                      <p className="text-slate-900">{selectedCustomer.taxId || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        ผู้ติดต่อ
                      </p>
                      <p className="text-slate-900">{selectedCustomer.contactName || "-"}</p>
                      {selectedCustomer.contactEmail && (
                        <p className="text-sm text-slate-500">{selectedCustomer.contactEmail}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        ที่อยู่
                      </p>
                      <p className="text-slate-900 text-sm leading-relaxed">
                        {selectedCustomer.address || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-row md:flex-col gap-2 items-start">
                    <button
                      type="button"
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all border border-transparent hover:border-red-100 shadow-sm hover:shadow"
                      title="ยกเลิกการเลือกลูกค้า"
                      onClick={() => setSelectedCustomer(null)}
                    >
                      <Icon name="close" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
               <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 bg-slate-50/50">
                <Icon name="group" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>ยังไม่ได้เลือกลูกค้า</p>
                <p className="text-sm mt-1">กรุณาค้นหาและเลือกลูกค้าจากช่องด้านบน</p>
              </div>
            )}
          </section>

          {/* Section 2: Products */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-primary flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                    2
                  </span>
                  สินค้า
                </h2>
                <p className="text-slate-500 mt-1">ค้นหาและเพิ่มสินค้าลงในใบเสนอราคา</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1" ref={productSearchRef}>
                <Icon name="inventory_2" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 border-l-4 border-l-primary focus:ring-1 focus:ring-primary focus:bg-white transition-all rounded-lg"
                  placeholder="รหัสสินค้า หรือ ชื่อสินค้า..."
                  type="text"
                  value={searchProduct}
                  onChange={(e) => {
                    setSearchProduct(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                />

                {/* Product Autocomplete Dropdown */}
                {showProductDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(product => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors flex justify-between items-center gap-2"
                          onClick={() => {
                            setPendingProduct(product);
                            setSearchProduct("");
                            setShowProductDropdown(false);
                          }}
                        >
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold text-slate-900 truncate">{product.name}</span>
                            <span className="text-xs text-slate-500 truncate">{product.sku || "ไม่มีรหัส"}</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        ไม่พบข้อมูลสินค้า
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button 
                type="button"
                className="px-6 py-3 border border-primary text-primary rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all whitespace-nowrap"
                onClick={() => setShowCustomForm(!showCustomForm)}
              >
                <Icon name={showCustomForm ? "close" : "add_box"} className="w-5 h-5" />
                {showCustomForm ? "ยกเลิกเพิ่มใหม่" : "เพิ่มสินค้าใหม่"}
              </button>
            </div>

            {/* Pending Product Price Selection */}
            {pendingProduct && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-blue-500 uppercase">เลือกประเภทราคาสำหรับ</span>
                  <span className="font-bold text-slate-900">{pendingProduct.name}</span>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    className="flex-1 md:flex-none px-4 py-2 bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-semibold transition-colors"
                    onClick={() => confirmProductWithPrice(pendingProduct, pendingProduct.userPrice)}
                  >
                    User: ฿{formatCurrencyPlain(Number(pendingProduct.userPrice || 0))}
                  </button>
                  <button
                    type="button"
                    className="flex-1 md:flex-none px-4 py-2 bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-semibold transition-colors"
                    onClick={() => confirmProductWithPrice(pendingProduct, pendingProduct.projectPrice)}
                  >
                    Project: ฿{formatCurrencyPlain(Number(pendingProduct.projectPrice || 0))}
                  </button>
                  <button
                    type="button"
                    className="flex-1 md:flex-none px-4 py-2 bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-semibold transition-colors"
                    onClick={() => confirmProductWithPrice(pendingProduct, pendingProduct.dealerPrice)}
                  >
                    Dealer: ฿{formatCurrencyPlain(Number(pendingProduct.dealerPrice || 0))}
                  </button>
                  <button
                    type="button"
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors ml-auto md:ml-0"
                    onClick={() => setPendingProduct(null)}
                    title="ยกเลิก"
                  >
                    <Icon name="close" className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Custom Product Form */}
            {showCustomForm && (
              <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row gap-3 items-end animate-in fade-in slide-in-from-top-2">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">ชื่อสินค้า</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="พิมพ์ชื่อสินค้า..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-48">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">ราคา (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="w-full md:w-auto px-6 py-2 bg-primary text-white font-bold rounded-md hover:bg-primary/90 transition-colors"
                  onClick={handleAddCustomProduct}
                >
                  เพิ่ม
                </button>
              </div>
            )}

            <div className={`md:hidden ${!showCustomForm ? "mt-8" : ""}`}>
              {quoteItems.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {quoteItems.map((item) => {
                    const totalBeforeDiscount = item.qty * item.price;
                    const discountAmount = totalBeforeDiscount * (item.discount / 100);
                    const finalTotal = totalBeforeDiscount - discountAmount;
                    return (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 break-words">{item.name}</p>
                            {item.detail ? (
                              <p className="mt-1 text-xs text-slate-500 break-words">{item.detail}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                            title="ลบรายการ"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Icon name="delete" className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            จำนวน
                            <input
                              type="number"
                              min="1"
                              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-right font-medium text-slate-900"
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                updateQuoteItem(item.id, { qty: val });
                              }}
                            />
                          </label>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            ราคาต่อหน่วย
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-right text-slate-700"
                              value={item.price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                updateQuoteItem(item.id, { price: val });
                              }}
                            />
                          </label>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            ส่วนลด (%)
                            <div className="relative mt-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="w-full rounded-md border border-slate-200 px-3 py-2 pr-7 text-right text-slate-700"
                                value={item.discount}
                                onChange={(e) => {
                                  let val = parseFloat(e.target.value) || 0;
                                  if (val > 100) val = 100;
                                  updateQuoteItem(item.id, { discount: val });
                                }}
                              />
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                %
                              </span>
                            </div>
                          </label>
                          <div className="rounded-md bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ยอดรวม</p>
                            <p className="mt-1 text-right text-base font-bold text-slate-900">
                              {formatCurrencyPlain(finalTotal)}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-slate-500">
                  <Icon name="inventory_2" className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  ยังไม่มีรายการสินค้า
                </div>
              )}
            </div>

            <div className={`hidden overflow-x-auto md:block ${!showCustomForm ? "mt-8" : ""}`}>
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left text-sm border-b border-slate-200">
                    <th className="px-4 py-3 font-semibold rounded-tl-lg">รายการสินค้า</th>
                    <th className="px-4 py-3 font-semibold text-right w-24">จำนวน</th>
                    <th className="px-4 py-3 font-semibold text-right w-36">ราคา/หน่วย</th>
                    <th className="px-4 py-3 font-semibold text-right w-28">ส่วนลด (%)</th>
                    <th className="px-4 py-3 font-semibold text-right w-36">ยอดรวม</th>
                    <th className="px-4 py-3 font-semibold text-center rounded-tr-lg w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quoteItems.length > 0 ? (
                    quoteItems.map((item) => {
                      const totalBeforeDiscount = item.qty * item.price;
                      const discountAmount = totalBeforeDiscount * (item.discount / 100);
                      const finalTotal = totalBeforeDiscount - discountAmount;
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-4 py-4">
                            <p className="font-bold text-slate-900">{item.name}</p>
                            {item.detail && <p className="text-xs text-slate-500 mt-1">{item.detail}</p>}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <input 
                              type="number" 
                              min="1"
                              className="w-16 text-right px-2 py-1 border border-slate-200 rounded text-slate-900 font-medium"
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                updateQuoteItem(item.id, { qty: val });
                              }}
                            />
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600">
                            <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              className="w-full text-right px-2 py-1 border border-slate-200 rounded text-slate-600"
                              value={item.price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                updateQuoteItem(item.id, { price: val });
                              }}
                            />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="relative inline-flex items-center">
                              <input 
                                type="number" 
                                min="0"
                                max="100"
                                className="w-16 text-right px-2 py-1 pr-6 border border-slate-200 rounded text-slate-600"
                                value={item.discount}
                                onChange={(e) => {
                                  let val = parseFloat(e.target.value) || 0;
                                  if (val > 100) val = 100;
                                  updateQuoteItem(item.id, { discount: val });
                                }}
                              />
                              <span className="absolute right-2 text-slate-400 pointer-events-none">%</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-slate-900">
                            {formatCurrencyPlain(finalTotal)}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              type="button"
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="ลบรายการ"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Icon name="delete" className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500 border-b-0 border-x border-slate-200 border-dashed rounded-b-lg">
                        <Icon name="inventory_2" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        ยังไม่มีรายการสินค้า
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {quoteItems.length > 0 && (
              <>
                <div className="mt-6 flex justify-end">
                  <div className="w-full md:w-1/3 bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col gap-2">
                    <div className="flex justify-between text-slate-600 text-sm">
                      <span>รวมเป็นเงิน:</span>
                      <span>{formatCurrencyPlain(quoteTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-sm">
                      <span>ส่วนลดรวม:</span>
                      <span>{formatCurrencyPlain(quoteTotals.discount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200 mt-1">
                      <span>ยอดรวมสุทธิ:</span>
                      <span className="text-primary">
                        ฿{formatCurrencyPlain(quoteTotals.total)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <label htmlFor="quoteNote" className="mb-2 block text-sm font-bold text-slate-700">
                    หมายเหตุ / ข้อเสนอและเงื่อนไข
                  </label>
                  <textarea
                    id="quoteNote"
                    rows={4}
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
                    placeholder="ระบุหมายเหตุ ข้อเสนอ หรือเงื่อนไขที่ต้องการให้แสดงในใบเสนอราคา PDF"
                    value={quoteNote}
                    onChange={(e) => setQuoteNote(e.target.value)}
                  />
                </div>

                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    className="px-10 py-4 bg-primary text-white font-bold text-lg rounded-xl shadow-lg hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 transition-all w-full md:w-auto"
                    onClick={() => {
                      if (!selectedCustomer) {
                        void swal("ข้อมูลไม่ครบถ้วน", "กรุณาเลือกหรือเพิ่มลูกค้าผู้รับใบเสนอราคาก่อนทำการบันทึก", "warning");
                        return;
                      }
                      setShowSummaryModal(true);
                    }}
                  >
                    บันทึกใบเสนอราคา
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Section 3: Quote History */}
          {savedQuotes.length > 0 && (
            <section id="quote-history" className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
              <h2 className="text-2xl font-semibold text-primary mb-6">ประวัติใบเสนอราคา</h2>
              <div className="flex flex-col gap-4">
                {savedQuotes.map((quote) => {
                  const isApprovalPending = approvalBusyId === quote.id;
                  const isPdfExporting = exportingId === quote.id;
                  const isDeleting = deletingQuoteId === quote.id;
                  const isExpanded = expandedQuoteId === quote.id;
                  const approvalStatus = approvalStatusById[quote.id];
                  const isApproved = approvalStatus === "approved";
                  const isPendingApproval = approvalStatus === "pending";

                  const btnText = isApproved
                    ? isPdfExporting
                      ? "กำลังเตรียม PDF..."
                      : "ดาวน์โหลด PDF"
                    : isApprovalPending
                      ? "กำลังส่งคำขอ..."
                      : isPendingApproval
                        ? "ขออนุมัติใหม่"
                        : "ขออนุมัติ";

                  const btnClass = isApproved
                    ? isPdfExporting
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 cursor-pointer"
                    : isApprovalPending
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : isPendingApproval
                        ? "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100"
                        : "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100";

                  return (
                    <div key={quote.id} className="rounded-xl border border-slate-200 p-5 transition-colors hover:border-slate-300">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <button
                        type="button"
                        className="block min-w-0 flex-1 rounded-lg text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                        aria-label={`ดูรายละเอียดใบเสนอราคา ${quote.customId || quote.id}`}
                        onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`quote-details-${quote.id}`}
                      >
                        <p className="mb-1 font-bold text-slate-900">{quote.customerName}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-700">{quote.customId || quote.id}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {quote.date}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">{quote.itemsCount} รายการ • ฿{formatCurrencyPlain(quote.total)}</p>
                      </button>
                      <div className="flex w-full items-center gap-2 md:w-auto">
                        <button
                          type="button"
                          className={`flex-1 px-6 py-2 rounded-lg font-bold text-sm transition-all md:flex-none ${btnClass}`}
                          onClick={() => {
                            if (isApproved) {
                              exportQuotePdf(quote.id);
                            } else {
                              void handleRequestApproval(quote.id);
                            }
                          }}
                          disabled={isApprovalPending || isPdfExporting}
                        >
                          {btnText}
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition-all hover:border-red-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void handleDeleteQuote(quote)}
                          disabled={isDeleting}
                          aria-label={`ลบใบเสนอราคา ${quote.customId || quote.id}`}
                          title="ลบใบเสนอราคา"
                        >
                          <Icon name="close" className="h-5 w-5" />
                        </button>
                      </div>
                      </div>
                      {isExpanded ? (
                        <div id={`quote-details-${quote.id}`} className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
                          <div className="mb-4 flex flex-col gap-1 text-sm md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-bold text-slate-900">{quote.customerName || "-"}</p>
                              <p className="text-slate-500">{quote.customId || quote.id}</p>
                            </div>
                            <p className="font-bold text-primary">฿{formatCurrencyPlain(quote.total)}</p>
                          </div>
                          <div className="divide-y divide-slate-200 rounded-lg bg-white">
                            {quote.items.length ? (
                              quote.items.map((item, index) => (
                                <div key={`${quote.id}-${index}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                                  <p className="font-medium text-slate-800">{item.description || "-"}</p>
                                  <p className="text-slate-500">{item.qty} x ฿{formatCurrencyPlain(item.price)}</p>
                                  <p className="font-bold text-slate-900 md:text-right">฿{formatCurrencyPlain(item.qty * item.price)}</p>
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-sm text-slate-500">ไม่มีรายการสินค้า</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
      </main>

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-2xl font-bold text-slate-900 text-center">สรุปใบเสนอราคา</h3>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">ลูกค้า</p>
                <p className="font-bold text-lg text-slate-900">{selectedCustomer?.companyName}</p>
                <p className="text-slate-600">{selectedCustomer?.contactName} {selectedCustomer?.contactPhone ? `(${selectedCustomer.contactPhone})` : ""}</p>
              </div>

              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">รายการสินค้า ({quoteItems.length})</p>
                <ul className="space-y-3">
                  {quoteItems.map(item => (
                    <li key={item.id} className="flex justify-between text-sm items-start gap-4">
                      <span className="text-slate-700 flex-1">
                        <span className="font-medium">{item.qty}x</span> {item.name}
                      </span>
                      <span className="text-slate-900 font-medium whitespace-nowrap">
                        ฿{formatCurrencyPlain((item.qty * item.price) * (1 - item.discount/100))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {quoteNote.trim() ? (
                <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    หมายเหตุ / ข้อเสนอและเงื่อนไข
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {quoteNote.trim()}
                  </p>
                </div>
              ) : null}

              <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                <p className="font-bold text-slate-900">ยอดรวมสุทธิ</p>
                <p className="text-2xl font-bold text-primary">
                  ฿{formatCurrencyPlain(quoteTotals.total)}
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                onClick={() => setShowSummaryModal(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 shadow-md transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                disabled={savingQuote}
                onClick={() => {
                  if (savingQuote) return;
                  const realUuid = createQuoteId();
                  const nextSeqNum = (() => {
                    if (savedQuotes.length > 0 && savedQuotes[0].customId) {
                      const match = savedQuotes[0].customId.match(/(\d+)$/);
                      if (match) {
                        return Number(match[1]) + 1;
                      }
                    }
                    return savedQuotes.length + 48;
                  })();
                  const nextCustomId = `QUO-2026-${String(nextSeqNum).padStart(3, "0")}`;
                  const items = quoteItems.map((item) => {
                    const skuMatch = item.detail?.match(/^SKU:\s*(.*)$/);
                    const sku = skuMatch ? skuMatch[1] : "";
                    const description = sku ? `${sku} - ${item.name}` : item.name;
                    return {
                      description,
                      qty: item.qty,
                      price: item.price,
                    };
                  });

                  const pin = window.sessionStorage.getItem("pin_auth")?.trim() ?? "";
                  const headers: Record<string, string> = { "Content-Type": "application/json" };
                  if (pin) headers["x-pin-auth"] = pin;

                  void (async () => {
                    setSavingQuote(true);
                    try {
                      const res = await fetch("/api/quotes", {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                          id: realUuid,
                          customerId: selectedCustomer?.id || null,
                          companyName: selectedCustomer?.companyName || "-",
                          systemName: selectedCustomer?.companyName || "-",
                          items,
                          discount: quoteTotals.discount,
                          note: quoteNote.trim(),
                        }),
                      });

                      const data = await res.json().catch(() => ({}));
                      if (res.ok) {
                        const newQuote = {
                          id: realUuid,
                          customId: nextCustomId,
                          date: new Date().toLocaleDateString('th-TH'),
                          customerName: selectedCustomer?.companyName,
                          items,
                          itemsCount: quoteItems.length,
                          total: quoteTotals.total
                        };
                         setSavedQuotes((quotes) => [newQuote, ...quotes]);
                        setShowSummaryModal(false);

                        await showJjsatsSuccessAlert(
                          "บันทึกสำเร็จแล้ว",
                          "ระบบบันทึกใบเสนอราคาเรียบร้อย และเพิ่มรายการไว้ในประวัติแล้ว",
                        );
                        
                        // Reset form
                        setSelectedCustomer(null);
                        setQuoteItems([]);
                        
                        // Sync with Supabase
                        void loadQuoteHistory();
                        
                        // Scroll to history
                        setTimeout(() => {
                          document.getElementById('quote-history')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      } else {
                        void swal("บันทึกไม่สำเร็จ", data.error || "เกิดข้อผิดพลาดในการบันทึกใบเสนอราคา กรุณาลองใหม่อีกครั้ง", "error");
                      }
                    } catch (error) {
                      console.error("Failed to save quotation:", error);
                      void swal("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกใบเสนอราคาได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต", "error");
                    } finally {
                      setSavingQuote(false);
                    }
                  })();
                }}
              >
                {savingQuote ? "กำลังบันทึก..." : "ยืนยันการบันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Loading Overlay for Requesting Approval */}
      {approvalBusyId && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="pin-page__ambient" aria-hidden="true" style={{ position: "absolute", zIndex: 0 }}>
            <span />
            <span />
            <span />
          </div>
          
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="pin-loader" aria-label="กำลังดำเนินการ"></div>
            <p className="text-white/90 font-bold text-lg animate-pulse tracking-wide font-sans mt-4">
              กำลังส่งคำขออนุมัติไปยัง Telegram...
            </p>
          </div>
        </div>
      )}

      <BottomNav items={visibleMenuItems} activeHref={activeHref} />
    </div>
  );
}
