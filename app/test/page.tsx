"use client";

import Link from "next/link";
import AppHeader from "@/components/AppHeader";

import BottomNav from "@/components/BottomNav";
import Icon, { type IconName } from "@/components/Icon";
import { usePinRole } from "@/components/PinRoleProvider";

type MenuItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
  prefetch?: boolean;
};

type ActivityTone = "pending" | "success" | "info";

type Activity = {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  status: string;
  tone: ActivityTone;
};

const menuItems: MenuItem[] = [
  { id: "quote2", href: "/quotation", label: "เสนอราคา2", icon: "description" },
  { id: "customer", href: "/customer", label: "ทะเบียนลูกค้า", icon: "group", adminOnly: true },
  {
    id: "product",
    href: "/product",
    label: "สินค้าบริษัท",
    icon: "inventory_2",
    adminOnly: true,
  },
  {
    id: "register",
    href: "/pin/register",
    label: "ลงทะเบียน",
    icon: "app_registration",
    adminOnly: true,
  },
  {
    id: "logout",
    href: "/logout",
    label: "ออกจากระบบ",
    icon: "logout",
    prefetch: false,
  },
];
const activities: Activity[] = [
  {
    id: "qt-2026-041",
    icon: "description",
    title: "บริษัท เจเจ เน็ตเวิร์ค โซลูชั่น จำกัด",
    detail: "QT-2026-041 · ฿128,450",
    status: "รอดำเนินการ",
    tone: "pending",
  },
  {
    id: "qt-2026-038",
    icon: "description",
    title: "บริษัท เอเชีย ซิสเต็ม เซอร์วิส จำกัด",
    detail: "QT-2026-038 · ฿47,200",
    status: "สำเร็จ",
    tone: "success",
  },
  {
    id: "customer-18",
    icon: "group",
    title: "เพิ่มลูกค้าใหม่",
    detail: "บริษัท นวัตกรรมไทย ดิจิทัล จำกัด",
    status: "2 ชม. ที่แล้ว",
    tone: "info",
  },
];

const statusClass: Record<ActivityTone, string> = {
  pending: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  info: "bg-slate-100 text-slate-500",
};

export default function TestPage() {
  const { role } = usePinRole();
  const activeHref = "/test";
  const visibleMenuItems =
    role === "admin" ? menuItems : menuItems.filter((item) => !item.adminOnly);

  return (
    <main className="test-dashboard min-h-[100dvh] pt-16 pb-28">
      <AppHeader items={visibleMenuItems} activeHref={activeHref} />

      <section className="mx-auto w-full max-w-[460px] overflow-hidden rounded-[28px] border border-[#ead7d7] bg-[#f8f6f6] shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e5d2d2] bg-[#f8f6f6]/90 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-primary bg-white text-primary">
              <Icon name="person" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary/80">ยินดีต้อนรับ</p>
              <h1 className="text-base font-bold leading-none text-[#1a0f0f]">Admin JJSATs</h1>
            </div>
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full border border-[#e5d2d2] bg-white text-[#1a0f0f] shadow-sm transition active:scale-[0.98]"
            aria-label="แจ้งเตือน"
          >
            <span className="relative flex">
              <Icon name="dashboard" className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />
            </span>
          </button>
        </div>

        <div className="space-y-5 p-4">
          <section className="rounded-xl bg-primary p-5 text-white shadow-[0_18px_34px_rgba(116,16,16,0.28)]">
            <p className="text-sm font-medium text-white/80">ยอดขายรวมเดือนนี้</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">฿450,000</p>
            <div className="mt-2 flex items-center gap-1 text-sm font-bold text-emerald-200">
              <span aria-hidden="true">↗</span>
              <span>+15.4%</span>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1a0f0f]">
              การดำเนินการที่ค้างอยู่
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/"
                className="flex flex-col items-start gap-2 rounded-xl border border-[#e5d2d2] bg-white p-4 text-[#1a0f0f] no-underline shadow-sm transition active:scale-[0.98]"
              >
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon name="description" className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-2xl font-bold">12</span>
                  <span className="block text-xs font-medium text-slate-500">
                    ใบเสนอราคาที่ค้าง
                  </span>
                </span>
              </Link>
              <Link
                href="/customer"
                className="flex flex-col items-start gap-2 rounded-xl border border-[#e5d2d2] bg-white p-4 text-[#1a0f0f] no-underline shadow-sm transition active:scale-[0.98]"
              >
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon name="group" className="h-5 w-5" />
                </span>
                <span>
                  <span className="mt-1 block text-sm font-bold">รายชื่อลูกค้า</span>
                  <span className="block text-xs font-medium text-slate-500">เข้าถึงด่วน</span>
                </span>
              </Link>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-[#1a0f0f]">กิจกรรมล่าสุด</h2>
              <Link href="/" className="text-sm font-bold text-primary no-underline">
                ดูทั้งหมด
              </Link>
            </div>
            <div className="space-y-3">
              {activities.map((activity) => (
                <article
                  key={activity.id}
                  className="flex items-center gap-4 rounded-xl border border-[#e5d2d2] bg-white p-4"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-primary">
                    <Icon name={activity.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-[#1a0f0f]">
                      {activity.title}
                    </h3>
                    <p className="text-xs text-slate-500">{activity.detail}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${statusClass[activity.tone]}`}
                  >
                    {activity.status}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      <BottomNav items={visibleMenuItems} activeHref={activeHref} />
    </main>
  );
}
