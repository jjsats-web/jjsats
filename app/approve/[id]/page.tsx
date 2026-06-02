import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import AppHeader from "@/components/AppHeader";

import ApprovalClient from "./ApprovalClient";
import { formatCurrencyPlain } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./approve.css";

const ADMIN_PINS = new Set(["000000", "111111", "222222"]);
const headerItems = [
  { id: "customer", href: "/customer", label: "ทะเบียนลูกค้า", icon: "group" as const },
  { id: "logout", href: "/logout", label: "ออกจากระบบ", icon: "logout" as const },
];

type QuoteItem = {
  description: string;
  qty: number;
  price: number;
};

type ApprovalStatus = "approved" | "pending" | "rejected" | "none";

type PinRow = {
  role: string | null;
};

type QuoteRow = {
  id: string;
  company_name: string | null;
  customer_id: string | null;
  system_name: string | null;
  items: unknown;
  total: number | null;
  created_at: string | null;
  note: string | null;
};

type CustomerRow = {
  company_name: string | null;
  tax_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
};

type ApprovalRow = {
  status: string | null;
  requested_at: string | null;
  requested_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
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

function formatQuoteNumber(id: string) {
  const digits = id.replace(/\D/g, "");
  return digits || id;
}

function formatQuoteDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("th-TH", { dateStyle: "short" });
}

function splitItemDescription(description: string) {
  const parts = description.split(" - ");
  if (parts.length >= 2) {
    const sku = parts.shift()?.trim() ?? "";
    const name = parts.join(" - ").trim();
    return { sku: sku || "-", description: name || "-" };
  }
  return { sku: "-", description: description || "-" };
}

function normalizeItems(rawItems: unknown): QuoteItem[] {
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

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

async function isAdminPin(pin: string) {
  if (!pin || pin === "ok") return false;
  if (ADMIN_PINS.has(pin)) return true;

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("pins")
    .select("role")
    .eq("pin", pin)
    .limit(1)
    .maybeSingle();

  const record = data as PinRow | null;
  return record?.role === "admin";
}

export default async function ApprovePage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const quoteId = readString(resolvedParams.id);
  if (!quoteId) {
    return (
      <main>
        <AppHeader items={headerItems} activeHref="/" />
        <div className="container">
          <h1>ตรวจสอบใบเสนอราคา</h1>
          <p style={{ color: "#b91c1c" }}>ไม่พบเลขที่ใบเสนอราคา</p>
        </div>
      </main>
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id,company_name,customer_id,system_name,items,total,created_at,note")
    .eq("id", quoteId)
    .limit(1)
    .maybeSingle();

  if (quoteError || !quote) {
    return (
      <main>
        <AppHeader items={headerItems} activeHref="/" />
        <div className="container">
          <h1>ตรวจสอบใบเสนอราคา</h1>
          <p style={{ color: "#b91c1c" }}>ไม่พบใบเสนอราคา</p>
        </div>
      </main>
    );
  }

  const quoteRow = quote as QuoteRow;
  let customerRow: CustomerRow | null = null;
  if (quoteRow.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("company_name,tax_id,contact_name,contact_phone,contact_email,address")
      .eq("id", quoteRow.customer_id)
      .limit(1)
      .maybeSingle();
    customerRow = customer as CustomerRow | null;
  }

  const items = normalizeItems(quoteRow.items);
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const total = readNumber(quoteRow.total);
  const discount = Math.max(subtotal - total, 0);
  const discountedSubtotal = Math.max(subtotal - discount, 0);
  const vat = discountedSubtotal * 0.07;
  const grandTotal = discountedSubtotal + vat;
  const discountDisplay = discount > 0 ? -discount : 0;

  const { data: approval } = await supabase
    .from("quote_approvals")
    .select("status,requested_at,requested_by,approved_at,approved_by")
    .eq("quote_id", quoteId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const approvalRow = approval as ApprovalRow | null;
  const rawStatus = readString(approvalRow?.status);
  const status: ApprovalStatus =
    rawStatus === "approved" || rawStatus === "pending" || rawStatus === "rejected"
      ? rawStatus
      : "none";

  const quoteNumber = formatQuoteNumber(quoteRow.id);
  const quoteRef = quoteRow.id.toUpperCase().startsWith("QT") ? quoteRow.id : quoteNumber;
  const quoteDate = formatQuoteDate(quoteRow.created_at);
  const customerName =
    readString(customerRow?.company_name) || readString(quoteRow.company_name) || "-";
  const customerAddress = readString(customerRow?.address) || "-";
  const attentionName = readString(customerRow?.contact_name) || customerName;
  const attentionPhone = readString(customerRow?.contact_phone);
  const attentionLine = [attentionName, attentionPhone ? `(${attentionPhone})` : ""]
    .filter(Boolean)
    .join(" ");
  const customerTaxId = readString(customerRow?.tax_id) || "-";
  const customerTel = readString(customerRow?.contact_phone) || "-";
  const customerEmail = readString(customerRow?.contact_email) || "-";
  const subjectLine = quoteRow.system_name ? `ใบเสนอราคา ${quoteRow.system_name}` : "-";
  const issuerName = readOptionalString(approvalRow?.requested_by) ?? "-";
  const issuerCaption = issuerName && issuerName !== "-" ? `(${issuerName})` : "( )";
  const noteContent = readOptionalString(quoteRow.note) ?? "-";

  const cookieStore = await cookies();
  const pinCookie = cookieStore.get("pin_auth")?.value ?? "";
  const canApprove = await isAdminPin(pinCookie);

  return (
    <main className="bg-slate-50 min-h-screen pb-20 approve-page-root">
      <AppHeader items={headerItems} activeHref="/" />

      <div className="approve-container">
        {/* Title Section */}
        <div className="approve-title-section">
          <div className="approve-title-badge">QUOTATION APPROVAL</div>
          <h1>ตรวจสอบและอนุมัติใบเสนอราคา</h1>
          <p className="approve-title-sub">
            เลขที่อ้างอิง: <span className="font-mono font-bold text-slate-800">{quoteRow.id}</span>
          </p>
        </div>

        {/* Beautiful 2-Column Split Dashboard */}
        <div className="approve-dashboard-grid">
          {/* Left Column: Summary Desk */}
          <div className="approve-summary-desk">
            {/* Financial Highlight Block */}
            <div className="approve-summary-card approve-card-metrics">
              <div className="approve-card-header">
                <span className="icon-wrapper bg-emerald-50 text-emerald-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <h3>ข้อมูลการเงิน / Financial Summary</h3>
              </div>
              <div className="approve-metrics-content">
                <div className="metric-row">
                  <span className="metric-label">ยอดรวมก่อนภาษี (Subtotal)</span>
                  <span className="metric-value">฿{formatCurrencyPlain(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="metric-row text-red-600">
                    <span className="metric-label">ส่วนลด (Discount)</span>
                    <span className="metric-value">-฿{formatCurrencyPlain(discount)}</span>
                  </div>
                )}
                <div className="metric-row">
                  <span className="metric-label">ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                  <span className="metric-value">฿{formatCurrencyPlain(vat)}</span>
                </div>
                <div className="metric-divider"></div>
                <div className="metric-row row-grand-total">
                  <span className="metric-label">ยอดสุทธิครอบคลุมภาษี</span>
                  <span className="metric-value-grand">฿{formatCurrencyPlain(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Customer Information Block */}
            <div className="approve-summary-card">
              <div className="approve-card-header">
                <span className="icon-wrapper bg-red-50 text-red-800">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                <h3>ข้อมูลลูกค้า / Client Directory</h3>
              </div>
              <div className="approve-card-body">
                <div className="info-row">
                  <span className="info-label">ชื่อลูกค้า / บริษัท</span>
                  <span className="info-value">{customerName}</span>
                </div>
                {customerTaxId && customerTaxId !== "-" && (
                  <div className="info-row">
                    <span className="info-label">เลขประจำตัวผู้เสียภาษี</span>
                    <span className="info-value font-mono">{customerTaxId}</span>
                  </div>
                )}
                {attentionLine && attentionLine !== "-" && (
                  <div className="info-row">
                    <span className="info-label">ผู้ติดต่อ</span>
                    <span className="info-value">{attentionLine}</span>
                  </div>
                )}
                {customerAddress && customerAddress !== "-" && (
                  <div className="info-row">
                    <span className="info-label">ที่อยู่จัดส่ง / ที่อยู่บริษัท</span>
                    <span className="info-value text-sm leading-relaxed">{customerAddress}</span>
                  </div>
                )}
                {(customerTel !== "-" || customerEmail !== "-") && (
                  <div className="info-contact-strip">
                    {customerTel && customerTel !== "-" && (
                      <span className="contact-tag">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {customerTel}
                      </span>
                    )}
                    {customerEmail && customerEmail !== "-" && (
                      <span className="contact-tag">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {customerEmail}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Document Details Block */}
            <div className="approve-summary-card">
              <div className="approve-card-header">
                <span className="icon-wrapper bg-red-50 text-red-800">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <h3>รายละเอียดใบสำคัญ / Document Details</h3>
              </div>
              <div className="approve-card-body">
                <div className="info-row">
                  <span className="info-label">ระบบ / โครงการ</span>
                  <span className="info-value">{quoteRow.system_name || "-"}</span>
                </div>
                {approvalRow?.requested_by && (
                  <div className="info-row">
                    <span className="info-label">ผู้ส่งขออนุมัติ</span>
                    <span className="info-value">{issuerName}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-label">วันที่ทำรายการ</span>
                  <span className="info-value">{formatDate(quoteRow.created_at)}</span>
                </div>
                {noteContent && noteContent !== "-" && (
                  <div className="info-row-full mt-2">
                    <span className="info-label-block">หมายเหตุและเงื่อนไข</span>
                    <span className="info-value-block bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-600 leading-relaxed font-sans">{noteContent}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Command Center */}
          <div className="approve-command-desk">
            {/* Approval Executive Panel */}
            <div className="approve-command-card">
              {canApprove ? (
                <div className="approve-action-panel">
                  <div className="approve-card-header mb-4">
                    <span className="icon-wrapper bg-slate-50 text-slate-800">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </span>
                    <h3 className="text-slate-800 font-bold text-base">แผงควบคุมการอนุมัติ / Command Console</h3>
                  </div>
                  <ApprovalClient quoteId={quoteId} initialStatus={status} canApprove={canApprove} />
                </div>
              ) : (
                <div className="approve-auth-reminder">
                  <div className="auth-lock-icon">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h2>ระบบควบคุมความปลอดภัย</h2>
                  <p>
                    เฉพาะผู้ดูแลระบบและผู้มีอำนาจลงนามเท่านั้น ที่จะสามารถตรวจสอบและอนุมัติใบเสนอราคานี้ได้ผ่านระบบเครือข่ายความปลอดภัย
                  </p>
                  <div className="auth-status-badge">
                    <span className="dot animate-pulse"></span>
                    ยังไม่ได้ยืนยันตัวตนด้วย PIN
                  </div>
                  <Link
                    href={`/pin?redirectTo=/approve/${quoteId}`}
                    className="auth-login-button"
                  >
                    <span>เข้าสู่ระบบด้วย PIN เพื่ออนุมัติ</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="quote-preview" aria-label="ใบเสนอราคา (ตัวอย่าง)">
          <div className="quote-preview__page">
            <header className="doc-header">
              <div className="logo">
                <Image
                  src="/jjsats-logo.png"
                  alt="JJSATs Technology"
                  width={120}
                  height={60}
                  unoptimized
                />
              </div>
              <div className="company">
                <div className="company-name">บริษัท เจเจแซท เทคโนโลยี จำกัด</div>
                <div className="company-detail">
                  54/52 ม.8 ถ.พุทธมณฑลสาย 5 ต.บางกระทึก อ.สามพราน จ.นครปฐม 73210
                </div>
                <div className="company-detail company-detail--line2">
                  โทร: 061-992-6993,096-823-4431 อีเมล: sales@jjsats.co.th,rungruengh@jjsats.co.th{" "}
                  <span className="tax-id-nowrap">เลขประจำตัวผู้เสียภาษี 0105554023435</span>
                </div>
              </div>
            </header>

            <div className="doc-title">QUOTATION</div>

            <section className="quote-box">
              <div className="quote-box__col">
                <div className="quote-row">
                  <div className="quote-label">บริษัท/Company:</div>
                  <div className="quote-value">{customerName}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">ลูกค้า/Customer:</div>
                  <div className="quote-value">{attentionLine || "-"}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">เรื่อง/Topic:</div>
                  <div className="quote-value">{subjectLine}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">ที่อยู่/Address:</div>
                  <div className="quote-value">{customerAddress}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">เลขประจำตัวผู้เสียภาษี (TaxID):</div>
                  <div className="quote-value">{customerTaxId}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">โทรศัพท์/Tel:</div>
                  <div className="quote-value">{customerTel}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">E-mail:</div>
                  <div className="quote-value">{customerEmail}</div>
                </div>
              </div>
              <div className="quote-box__col">
                <div className="quote-row">
                  <div className="quote-label">เลขที่/QT No.</div>
                  <div className="quote-value">{quoteRef}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">วันที่/Issue:</div>
                  <div className="quote-value">{quoteDate}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">พนักงานขาย/Issuer:</div>
                  <div className="quote-value">{issuerName}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">โทรศัพท์/Tel:</div>
                  <div className="quote-value">0619926993</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">อีเมล/E-mail:</div>
                  <div className="quote-value">sales@jjsat.co.th</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">ยืนยันราคา/Valid Untill:</div>
                  <div className="quote-value">15 วัน</div>
                </div>
              </div>
            </section>

            <div className="intro">
              ทางบริษัทขอเสนอราคาและรายละเอียดตามรายการดังต่อไปนี้
            </div>

            {items.length ? (
              <table className="items">
                <thead>
                  <tr>
                    <th className="seq">
                      <div className="th-cell">ลำดับ<br />No.</div>
                    </th>
                    <th>
                      <div className="th-cell">รายละเอียด<br />Description</div>
                    </th>
                    <th className="unit">
                      <div className="th-cell">จำนวน<br />Unit</div>
                    </th>
                    <th className="num">
                      <div className="th-cell">หน่วย<br />QTY</div>
                    </th>
                    <th className="num">
                      <div className="th-cell">ราคา/หน่วย<br />Untill price</div>
                    </th>
                    <th className="num">
                      <div className="th-cell">ราคารวม<br />Amount</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const { sku, description } = splitItemDescription(item.description);
                    const descriptionWithSku = sku !== "-" ? `${sku} - ${description}` : description;
                    return (
                      <tr key={`${quoteId}-${index}`}>
                        <td className="seq">{index + 1}</td>
                        <td>{descriptionWithSku}</td>
                        <td className="unit">-</td>
                        <td className="num">{item.qty}</td>
                        <td className="num">{formatCurrencyPlain(item.price)}</td>
                        <td className="num">{formatCurrencyPlain(item.qty * item.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty">ไม่พบรายการสินค้า</div>
            )}

            <div className="summary">
              <table>
                <tbody>
                  <tr>
                    <td className="label">ยอดรวม</td>
                    <td className="value">{formatCurrencyPlain(subtotal)}</td>
                  </tr>
                  <tr>
                    <td className="label">ส่วนลด</td>
                    <td className="value">{formatCurrencyPlain(discountDisplay)}</td>
                  </tr>
                  <tr>
                    <td className="label">ภาษีมูลค่าเพิ่ม (7%)</td>
                    <td className="value">{formatCurrencyPlain(vat)}</td>
                  </tr>
                  <tr>
                    <td className="label grand">ยอดรวมสุทธิ</td>
                    <td className="value grand">{formatCurrencyPlain(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <section className="note">
              <div className="note-title">ข้อเสนอและเงื่อนไข</div>
              <div className="note-body">{noteContent}</div>
            </section>

            <div className="signatures">
              <div className="signature">
                <div className="signature-line"></div>
                <div className="signature-name">{issuerCaption}</div>
                <div>พนักงานขาย/Issuer</div>
              </div>
              <div className="signature signature--approval">
                <div className="signature-approval-title">พิจารณาตกลงจัดซื้อจัดจ้าง</div>
                <div className="signature-approval-line">
                  <span className="label">ลงชื่อ</span>
                  <span className="line"></span>
                </div>
                <div className="signature-approval-caption">
                  ผู้มีอำนาจลงนามเพื่อยืนยันการจัดซื้อจัดจ้าง พร้อมตราประทับ
                  (ถ้ามี)
                </div>
              </div>
            </div>
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
