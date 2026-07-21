"use client";

import Link from "next/link";
import { useEffect } from "react";

import Icon from "@/components/Icon";
import "./home.css";

const featureItems = [
  { label: "ปลอดภัย", icon: "verified" },
  { label: "คลาวด์ซิงค์", icon: "cloud" },
  { label: "อัปเดตเรียลไทม์", icon: "pulse" },
];

export default function HomePage() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("home-scroll-lock");
    body.classList.add("home-scroll-lock");

    return () => {
      root.classList.remove("home-scroll-lock");
      body.classList.remove("home-scroll-lock");
    };
  }, []);

  return (
    <main className="home-page">
      <div className="home-page__glow home-page__glow--top" aria-hidden="true" />
      <div className="home-page__glow home-page__glow--bottom" aria-hidden="true" />

      <div className="home-shell">
        <header className="home-brand">
          <div className="home-brand__mark">
            <Icon name="description" className="home-brand__icon" />
          </div>
          <div>
            <h1>ระบบจัดการใบเสนอราคา</h1>
            <p>Enterprise Pro Solution</p>
          </div>
        </header>

        <section className="home-hero">
          <div className="home-visual" aria-label="ตัวอย่างแดชบอร์ดใบเสนอราคา">
            <div className="home-card home-card--primary">
              <div className="home-card__heading">
                <span className="home-card__avatar">↗</span>
                <div>
                  <span className="home-skeleton home-skeleton--long" />
                  <span className="home-skeleton home-skeleton--short" />
                </div>
              </div>
              <div className="home-card__lines">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="home-card home-card--status">
              <div className="home-status__top">
                <span>สถานะล่าสุด</span>
                <strong>อนุมัติแล้ว</strong>
              </div>
              <b>฿125,000.00</b>
              <span className="home-progress" />
            </div>
          </div>

          <div className="home-copy">
            <p className="home-eyebrow">JJSATs quotation</p>
            <h2>
              จัดการเอกสารอย่างมืออาชีพ
              <span>รวดเร็ว และแม่นยำ</span>
            </h2>
            <p className="home-description">
              เพิ่มประสิทธิภาพในการขายและบริหารจัดการใบเสนอราคาในที่เดียว
              พร้อมติดตามสถานะและส่งขออนุมัติได้อย่างเป็นระบบ
            </p>
            <Link href="/quotation" className="home-cta">
              <span>เริ่มต้นใช้งาน</span>
              <span aria-hidden="true">→</span>
            </Link>

            <div className="home-features">
              {featureItems.map((feature) => (
                <div className="home-feature" key={feature.label}>
                  <span className={`home-feature__icon home-feature__icon--${feature.icon}`} aria-hidden="true">
                    {feature.icon === "verified" ? "✓" : feature.icon === "cloud" ? "⌁" : "◌"}
                  </span>
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="home-footer">© 2024 Enterprise Quotation Management System. All rights reserved.</footer>
      </div>
    </main>
  );
}
