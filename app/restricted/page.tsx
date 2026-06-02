import Link from "next/link";
import AppHeader from "@/components/AppHeader";

type RestrictedPageProps = {
  searchParams?: { from?: string | string[] };
};

function normalizeFrom(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/")) return "";
  return raw;
}

export default function RestrictedPage({ searchParams }: RestrictedPageProps) {
  const fromPath = normalizeFrom(searchParams?.from);
  const headerItems = [
    { id: "customer", href: "/customer", label: "ทะเบียนลูกค้า", icon: "group" as const },
    { id: "logout", href: "/logout", label: "ออกจากระบบ", icon: "logout" as const },
  ];

  return (
    <main>
      <AppHeader items={headerItems} activeHref="/" />

      <div className="container">
        <h1>สิทธิ์ไม่เพียงพอ</h1>
        <p style={{ color: "var(--muted)", marginTop: "-0.4rem" }}>
          หน้านี้อนุญาตเฉพาะผู้ที่เข้าสู่ระบบด้วย PIN 000000 เท่านั้น
        </p>
        {fromPath ? (
          <div style={{ marginTop: "0.8rem", color: "var(--muted)" }}>
            หน้าเป้าหมาย: <strong style={{ color: "var(--text)" }}>{fromPath}</strong>
          </div>
        ) : null}

        <div className="actions" style={{ justifyContent: "flex-start" }}>
          <Link href="/pin" className="ghost-link">
            กรอก PIN ใหม่
          </Link>
          <Link href="/" className="ghost-link">
            กลับหน้าใบเสนอราคา
          </Link>
        </div>
      </div>
    </main>
  );
}
