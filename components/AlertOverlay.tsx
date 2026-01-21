 "use client";

import { AlertCircleIcon, CheckCircle2Icon, PopcornIcon, XIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type AlertOverlayProps = {
  open: boolean;
  onClose: () => void;
  kind?: "success" | "error" | "info";
  title: string;
  description?: string;
  className?: string;
};

const iconByKind = {
  success: CheckCircle2Icon,
  error: AlertCircleIcon,
  info: PopcornIcon,
};

/**
 * Full-screen overlay alert that renders in the center of the viewport.
 */
export function AlertOverlay({
  open,
  onClose,
  kind = "info",
  title,
  description,
  className,
}: AlertOverlayProps) {
  if (!open) return null;

  const Icon = iconByKind[kind] ?? PopcornIcon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="alert-overlay-backdrop"
      onClick={onClose}
    >
      <div
        className={cn("alert-overlay-card", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="ปิด"
          className="alert-overlay-close"
          onClick={onClose}
        >
          <XIcon />
        </button>
        <Alert variant={kind === "error" ? "destructive" : "default"}>
          <Icon />
          <AlertTitle>{title}</AlertTitle>
          {description ? <AlertDescription>{description}</AlertDescription> : null}
        </Alert>
      </div>
    </div>
  );
}

export default AlertOverlay;
