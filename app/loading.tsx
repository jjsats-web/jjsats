import Image from "next/image";

export default function Loading() {
  return (
    <div id="loading-indicator" aria-live="polite" aria-busy="true">
      <div className="navigation-transition__core" aria-hidden="true">
        <div className="navigation-transition__brand">
          <span className="navigation-transition__brand-halo" />
          <span className="navigation-transition__brand-window">
            <Image
              className="navigation-transition__brand-image"
              src="/jjsats-loader-logo.png"
              alt=""
              width={160}
              height={160}
              priority
            />
          </span>
        </div>
        <div className="navigation-transition__progress">
          <span />
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
