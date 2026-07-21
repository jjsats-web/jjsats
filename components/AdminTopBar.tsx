"use client";

import { type CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import "./AdminTopBar.css";

export type AdminTopBarItem = {
  id: string;
  href: string;
  label: string;
  icon?: IconName;
  prefetch?: boolean;
};

type AdminTopBarProps = {
  title: string;
  subtitle?: string;
  items?: AdminTopBarItem[];
  activeHref?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  leftOffset?: string;
  profileName?: string;
  profileRole?: string;
};

export default function AdminTopBar({
  title,
  subtitle,
  items = [],
  activeHref,
  searchValue,
  onSearchChange,
  searchPlaceholder = "ค้นหา...",
  leftOffset = "0px",
  profileName,
  profileRole = "ผู้ใช้งาน",
}: AdminTopBarProps) {
  const [loadedProfileName, setLoadedProfileName] = useState("");
  const [loadedProfileRole, setLoadedProfileRole] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (profileName) return;
    let cancelled = false;
    async function loadProfile() {
      try {
        const response = await fetch("/api/pin", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          firstName?: string;
          lastName?: string;
          role?: string;
        };
        const name = [data.firstName?.trim(), data.lastName?.trim()].filter(Boolean).join(" ");
        if (!cancelled) {
          setLoadedProfileName(name);
          setLoadedProfileRole(data.role === "admin" ? "Administrator" : "User");
          setProfileLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setLoadedProfileName("");
          setLoadedProfileRole("");
          setProfileLoaded(true);
        }
      }
    }
    void loadProfile();
    return () => { cancelled = true; };
  }, [profileName]);

  return (
    <header
      className="admin-topbar"
      style={{ "--admin-topbar-left": leftOffset } as CSSProperties}
    >
      <div className="admin-topbar__heading">
        <strong>{title}</strong>
        {subtitle ? <><span>/</span><small>{subtitle}</small></> : null}
      </div>
      {onSearchChange ? (
        <label className="admin-topbar__search">
          <Icon name="search" />
          <input
            type="search"
            value={searchValue ?? ""}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
      ) : null}
      {items.length > 0 ? (
        <nav className="admin-topbar__nav" aria-label="เมนูหลัก">
          {items.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={item.prefetch ?? false}
                className={isActive ? "is-active" : ""}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon ? <Icon name={item.icon} bold={isActive} /> : null}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
      <div className="admin-topbar__profile-area">
        <button type="button" aria-label="การแจ้งเตือน"><Icon name="notifications" /><i /></button>
        <div className="admin-topbar__profile">
          <Icon name="account_circle" />
          <span>
            <b>{profileName || loadedProfileName || (profileLoaded ? "ผู้ใช้งาน" : "\u00a0")}</b>
            <small>{loadedProfileRole || (profileLoaded ? profileRole : "\u00a0")}</small>
          </span>
        </div>
      </div>
    </header>
  );
}
