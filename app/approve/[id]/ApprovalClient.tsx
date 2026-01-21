"use client";

import { useState } from "react";
import swal from "sweetalert";

type ApprovalStatus = "approved" | "pending" | "rejected" | "none";

type ApprovalClientProps = {
  quoteId: string;
  initialStatus: ApprovalStatus;
  canApprove: boolean;
};

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  approved: "อนุมัติแล้ว",
  pending: "รอการอนุมัติ",
  rejected: "ปฏิเสธ",
  none: "ยังไม่มีคำขออนุมัติ",
};

export default function ApprovalClient({
  quoteId,
  initialStatus,
  canApprove,
}: ApprovalClientProps) {
  const [status, setStatus] = useState<ApprovalStatus>(initialStatus);
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async () => {
    if (!canApprove) {
      await swal("บัญชีนี้ไม่มีสิทธิ์อนุมัติ");
      return;
    }

    if (status === "approved" || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/quote-approvals/${encodeURIComponent(quoteId)}/approve`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      if (!res.ok) {
        await swal(data.error || "อนุมัติไม่สำเร็จ");
        return;
      }

      setStatus(data.status === "approved" ? "approved" : status);
      await swal("อนุมัติเรียบร้อยแล้ว");
    } catch {
      await swal("เกิดข้อผิดพลาดในการอนุมัติ");
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = STATUS_LABELS[status] ?? STATUS_LABELS.none;

  return (
    <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.8rem" }}>
      <div style={{ color: "var(--muted)" }}>
        สถานะ: <strong style={{ color: "var(--text)" }}>{statusLabel}</strong>
      </div>
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <button
          type="button"
          className="blob-button"
          onClick={() => void handleApprove()}
          disabled={submitting || status === "approved" || !canApprove}
        >
          <span className="blob-button__text">
            {submitting ? "กำลังอนุมัติ..." : "อนุมัติใบเสนอราคา"}
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
      {!canApprove ? (
        <div style={{ color: "#b91c1c" }}>บัญชีนี้ไม่มีสิทธิ์อนุมัติ</div>
      ) : null}
    </div>
  );
}
