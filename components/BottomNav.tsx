"use client";

import Link from "next/link";

import Icon, { type IconName } from "@/components/Icon";

type BottomNavItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  prefetch?: boolean;
};

type BottomNavProps = {
  items: BottomNavItem[];
  activeHref: string;
};

export default function BottomNav({ items, activeHref }: BottomNavProps) {
  return (
    <nav
      className="app-bottom-nav fixed left-0 w-full bg-white dark:bg-surface-dark border-t border-slate-100 dark:border-border-dark flex justify-around items-center py-2 px-6 z-30 lg:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={item.prefetch}
            className={`flex flex-col items-center gap-1 ${
              isActive ? "text-primary" : "text-slate-400"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon name={item.icon} className="h-6 w-6" bold={isActive} />
            <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
