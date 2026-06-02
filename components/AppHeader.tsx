"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";

export type AppHeaderItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  prefetch?: boolean;
};

type AppHeaderProps = {
  items: AppHeaderItem[];
  activeHref: string;
  brand?: string;
};

type PinProfile = {
  firstName?: string;
  lastName?: string;
};

export default function AppHeader({
  items,
  activeHref,
  brand = "ใบเสนอราคา",
}: AppHeaderProps) {
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const pin = window.sessionStorage.getItem("pin_auth")?.trim() ?? "";
        const headers: Record<string, string> = pin ? { "x-pin-auth": pin } : {};
        const res = await fetch("/api/pin", { headers, cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as PinProfile;
        const fullName = [data.firstName?.trim(), data.lastName?.trim()]
          .filter(Boolean)
          .join(" ");

        if (!cancelled) {
          setProfileName(fullName);
        }
      } catch {
        if (!cancelled) {
          setProfileName("");
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-10 h-16 bg-white shadow-sm border-b border-slate-200">
      <div className="flex items-center gap-12">
        <span className="text-2xl font-bold text-primary">{brand}</span>
        <div className="hidden md:flex items-center gap-8 h-full">
          {items.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={item.prefetch ?? false}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary font-bold border-b-2 border-primary pb-1"
                    : "text-slate-500 hover:text-primary"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative group">
          <button
            type="button"
            className="text-slate-500 hover:bg-slate-100 p-2 rounded-full transition-all"
            aria-label="แจ้งเตือน"
          >
            <Icon name="notifications" className="h-6 w-6" />
          </button>
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
        </div>
        <div className="flex items-center gap-3 cursor-pointer p-1 pr-3 hover:bg-slate-100 rounded-full transition-all">
          <Icon name="account_circle" className="text-slate-500 w-8 h-8" />
          <span className="text-sm font-medium text-slate-900 hidden lg:block">
            {profileName || "ผู้ใช้งาน"}
          </span>
        </div>
      </div>
    </nav>
  );
}
