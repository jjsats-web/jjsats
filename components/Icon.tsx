"use client";

import type { SVGProps } from "react";

export type IconName =
  | "description"
  | "dashboard"
  | "group"
  | "inventory_2"
  | "app_registration"
  | "password"
  | "logout"
  | "person"
  | "search"
  | "person_add"
  | "visibility"
  | "edit"
  | "add_box"
  | "add_circle"
  | "delete"
  | "close"
  | "account_circle"
  | "notifications";

type IconProps = {
  name: IconName;
  className?: string;
  bold?: boolean;
};

const baseProps: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export default function Icon({ name, className, bold = false }: IconProps) {
  const strokeWidth = bold ? 2.5 : 2;

  switch (name) {
    case "dashboard":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M4 4h7v7H4z" />
          <path d="M13 4h7v4h-7z" />
          <path d="M13 10h7v10h-7z" />
          <path d="M4 13h7v7H4z" />
        </svg>
      );
    case "description":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
          <path d="M9 9h2" />
        </svg>
      );
    case "group":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M17 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 19.5V21" />
          <path d="M11 12a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0z" />
          <path d="M20 21v-1.5a3.5 3.5 0 0 0-2.5-3.35" />
          <path d="M15.5 5.5a3.5 3.5 0 0 1 0 7" />
        </svg>
      );
    case "inventory_2":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M21 7.5 12 12 3 7.5 12 2z" />
          <path d="M3 7.5V17l9 5 9-5V7.5" />
          <path d="M12 12v10" />
        </svg>
      );
    case "app_registration":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
          <path d="M19 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
        </svg>
      );
    case "password":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <circle cx="7.5" cy="12" r="3.5" />
          <path d="M11 12h10" />
          <path d="M18 12v3" />
          <path d="M15 12v2" />
        </svg>
      );
    case "logout":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M15 4h-6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
          <path d="M10 12h10" />
          <path d="M16 8l4 4-4 4" />
        </svg>
      );
    case "person":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "search":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "person_add":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    case "visibility":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "edit":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case "add_box":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "add_circle":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "delete":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      );
    case "close":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "account_circle":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="10" r="3" />
          <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps} className={className} strokeWidth={strokeWidth}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      );
  }
}
