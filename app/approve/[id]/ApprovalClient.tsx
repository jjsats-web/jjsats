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
  const isApproved = status === "approved";
  const badgeClass = isApproved
    ? "status-badge status-badge--approved"
    : status === "pending"
      ? "status-badge status-badge--pending"
      : status === "rejected"
        ? "status-badge status-badge--rejected"
        : "status-badge status-badge--none";

  return (
    <div className="approve-action-wrapper">
      <div className="approve-action-status">
        <span className="status-title">สถานะใบเสนอราคา / Status</span>
        <span className={badgeClass}>{statusLabel}</span>
      </div>
      
      <div className="approve-action-controls">
        <button
          type="button"
          className={`approve-submit-btn ${isApproved ? "btn--approved" : ""} ${submitting ? "btn--submitting" : ""}`}
          onClick={() => void handleApprove()}
          disabled={submitting || isApproved || !canApprove}
        >
          {submitting ? (
            <>
              <span className="approve-spinner"></span>
              <span>กำลังบันทึกการอนุมัติ...</span>
            </>
          ) : isApproved ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>ใบเสนอราคาได้รับการอนุมัติแล้ว</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>อนุมัติใบเสนอราคา / Approve Quote</span>
            </>
          )}
        </button>
      </div>
      
      {!canApprove ? (
        <div className="approve-error-msg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>บัญชีนี้ไม่มีสิทธิ์อนุมัติ (กรุณาล็อกอินด้วย PIN ผู้ดูแลระบบ)</span>
        </div>
      ) : null}
    </div>
  );
}
