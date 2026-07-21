import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon";
import "./AdminPageHeading.css";

type AdminPageHeadingProps = {
  title: string;
  icon: IconName;
  meta?: ReactNode;
};

export default function AdminPageHeading({ title, icon, meta }: AdminPageHeadingProps) {
  return (
    <header className="admin-page-heading">
      <span className="admin-page-heading__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className="admin-page-heading__content">
        <h1>{title}</h1>
        {meta ? <div className="admin-page-heading__meta">{meta}</div> : null}
      </div>
    </header>
  );
}
