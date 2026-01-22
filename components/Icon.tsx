"use client";

import type { SVGProps } from "react";

export type IconName =
  | "description"
  | "group"
  | "inventory_2"
  | "app_registration"
  | "password"
  | "logout"
  | "person";

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
