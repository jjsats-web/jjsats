"use client";

import { formatCurrency } from "@/lib/format";

type Summary = {
  subtotal: number;
  vat: number;
  discount: number;
  total: number;
};

type SummaryCardProps = {
  totals: Summary;
  vatIncluded: boolean;
};

export default function SummaryCard({
  totals,
  vatIncluded,
}: SummaryCardProps) {
  return (
    <aside className="card space-y-4 bg-slate-900 p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">สรุปยอด</p>
          <h2 className="text-lg font-semibold text-white">ยอดที่ต้องชำระ</h2>
        </div>
        <span className="pill pill-dark">
          {vatIncluded ? "คิด VAT 7%" : "ไม่รวม VAT"}
        </span>
      </div>

      <div className="space-y-3 rounded-xl bg-slate-800/60 p-4">
        <Row label="รวมย่อย" value={totals.subtotal} />
        <Row label="ส่วนลดท้ายบิล" value={-totals.discount} />
        <Row label="VAT 7%" value={totals.vat} />
        <div className="h-px bg-white/10" />
        <Row label="ยอดสุทธิ" value={totals.total} emphasis />
      </div>

      <div className="space-y-2 text-xs text-slate-300">
        <p>ชำระโดยการโอน พร้อมเพย์ หรือบัญชีธนาคารภายใน 15 วัน</p>
        <p>แนบลายเซ็น/ตราประทับบริษัท ก่อนส่งอีเมลให้ลูกค้า</p>
      </div>

      <div className="grid gap-2">
        <button className="btn-primary w-full">ส่งให้ลูกค้า</button>
        <button className="btn-ghost-dark w-full">บันทึกเป็น Draft</button>
      </div>
    </aside>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-300">{label}</span>
      <span
        className={`font-semibold ${
          emphasis ? "text-lg text-white" : "text-slate-100"
        }`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
