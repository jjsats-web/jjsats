import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import "./AdminSidebar.css";

export type AdminSidebarItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  prefetch?: boolean;
};

type AdminSidebarProps = {
  items: AdminSidebarItem[];
  activeHref: string;
  brandSubtitle?: string;
};

export default function AdminSidebar({
  items,
  activeHref,
  brandSubtitle = "JJSATs ADMIN",
}: AdminSidebarProps) {
  const navigationItems = items.filter((item) => item.id !== "logout");
  const footerItems = items.filter((item) => item.id === "logout");

  return (
    <aside className="admin-sidebar" aria-label="เมนูหลัก">
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__logo">
          <Icon name="inventory_2" />
        </div>
        <div>
          <strong>ระบบใบเสนอราคา</strong>
          <span>{brandSubtitle}</span>
        </div>
      </div>

      <nav className="admin-sidebar__nav">
        {navigationItems.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={item.prefetch ?? false}
              className={isActive ? "is-active" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon name={item.icon} bold={isActive} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar__footer">
        {footerItems.map((item) => (
          <Link key={item.id} href={item.href} prefetch={false}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
