import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import ApprovalClient from "./ApprovalClient";
import { formatCurrencyPlain } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./approve.css";

const ADMIN_PIN = "000000";

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
  if (pin === ADMIN_PIN) return true;

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
        <header className="topbar">
          <div className="topbar__brand">JJSATs Quotation</div>
          <nav>
            <Link href="/">ใบเสนอราคา</Link>
            <Link href="/customer">ทะเบียนลูกค้า</Link>
            <Link href="/logout">ออกจากระบบ</Link>
          </nav>
        </header>
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
        <header className="topbar">
          <div className="topbar__brand">JJSATs Quotation</div>
          <nav>
            <Link href="/">ใบเสนอราคา</Link>
            <Link href="/customer">ทะเบียนลูกค้า</Link>
            <Link href="/logout">ออกจากระบบ</Link>
          </nav>
        </header>
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
      .select("company_name,tax_id,contact_name,contact_phone,address")
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
  const subjectLine = quoteRow.system_name ? `ใบเสนอราคา ${quoteRow.system_name}` : "-";
  const issuerName = readOptionalString(approvalRow?.requested_by) ?? "-";
  const issuerCaption = issuerName && issuerName !== "-" ? `(${issuerName})` : "( )";
  const noteContent = readOptionalString(quoteRow.note) ?? "-";

  const cookieStore = await cookies();
  const pinCookie = cookieStore.get("pin_auth")?.value ?? "";
  const canApprove = await isAdminPin(pinCookie);

  return (
    <main>
      <header className="topbar">
        <div className="topbar__brand">JJSATs Quotation</div>
        <nav>
          <Link href="/">ใบเสนอราคา</Link>
          <Link href="/customer">ทะเบียนลูกค้า</Link>
          <Link href="/logout">ออกจากระบบ</Link>
        </nav>
      </header>

      <div className="container">
        <h1>ตรวจสอบใบเสนอราคา</h1>
        <p style={{ color: "var(--muted)", marginTop: "-0.4rem" }}>
          เลขที่ {quoteRow.id} | วันที่ {formatDate(quoteRow.created_at)}
        </p>

        <ApprovalClient quoteId={quoteId} initialStatus={status} canApprove={canApprove} />

        <div style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
          <div>
            <strong>ลูกค้า:</strong> {readString(quoteRow.company_name) || "-"}
          </div>
          <div>
            <strong>ระบบ:</strong> {readString(quoteRow.system_name) || "-"}
          </div>
          {approvalRow?.requested_by ? (
            <div>
              <strong>ผู้ขออนุมัติ:</strong> {readOptionalString(approvalRow.requested_by) ?? "-"}
            </div>
          ) : null}
          {approvalRow?.requested_at ? (
            <div>
              <strong>ขออนุมัติเมื่อ:</strong> {formatDate(approvalRow.requested_at)}
            </div>
          ) : null}
          {approvalRow?.approved_at ? (
            <div>
              <strong>อนุมัติเมื่อ:</strong> {formatDate(approvalRow.approved_at)}
            </div>
          ) : null}
          {approvalRow?.approved_by ? (
            <div>
              <strong>ผู้อนุมัติ:</strong> {readOptionalString(approvalRow.approved_by) ?? "-"}
            </div>
          ) : null}
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
                />
              </div>
              <div className="company">
                <div className="company-name">บริษัท เจเจแซท เทคโนโลยี จำกัด</div>
                <div className="company-detail">
                  54/52 หมู่ที่ 8 ต.เทพารักษ์ อ.เมืองสมุทรสาคร จ.สมุทรสาคร 73210
                </div>
                <div className="company-detail">
                  โทร: 061-992-6993, 096-823-4431 อีเมล: sales@jjsats.co.th,
                  rungruengh@jjsats.co.th หมายเลขประจำตัวผู้เสียภาษี 0105554023435
                </div>
              </div>
            </header>

            <div className="doc-title">QUOTATION</div>

            <section className="quote-box">
              <div className="quote-box__col">
                <div className="quote-row">
                  <div className="quote-label">ลูกค้า/Customer:</div>
                  <div className="quote-value">{customerName}</div>
                </div>
                <div className="quote-row">
                  <div className="quote-label">เรียน/ATTN:</div>
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
              </div>
              <div className="quote-box__col">
                <div className="quote-row">
                  <div className="quote-label">ใบเสนอราคาเลขที่/No.</div>
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
              </div>
            </section>

            <div className="intro">
              ทางบริษัทขอเสนอราคาและรายละเอียดตามรายการดังต่อไปนี้
            </div>

            {items.length ? (
              <table className="items">
                <thead>
                  <tr>
                    <th className="code">
                      <div className="th-cell">รหัสสินค้า</div>
                    </th>
                    <th>
                      <div className="th-cell">รายละเอียด</div>
                    </th>
                    <th className="num">
                      <div className="th-cell">จำนวน/Unit</div>
                    </th>
                    <th className="num">
                      <div className="th-cell">ราคา/Price</div>
                    </th>
                    <th className="num">
                      <div className="th-cell">รวม</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const { sku, description } = splitItemDescription(item.description);
                    return (
                      <tr key={`${quoteId}-${index}`}>
                        <td className="code">{sku}</td>
                        <td>{description}</td>
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
