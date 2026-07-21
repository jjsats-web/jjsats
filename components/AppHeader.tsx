"use client";

import AdminTopBar, { type AdminTopBarItem } from "@/components/AdminTopBar";
import { type IconName } from "@/components/Icon";

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

export default function AppHeader({
  items,
  activeHref,
  brand = "ใบเสนอราคา",
}: AppHeaderProps) {
  return (
    <AdminTopBar
      title={brand}
      items={items as AdminTopBarItem[]}
      activeHref={activeHref}
    />
  );
}
