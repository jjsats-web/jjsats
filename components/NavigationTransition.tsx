"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TRANSITION_MS = 300;

export default function NavigationTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionRef = useRef(false);
  const navigationTimer = useRef<number | null>(null);
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!transitionRef.current) return;
    dismissTimer.current = window.setTimeout(() => {
      transitionRef.current = false;
      setIsTransitioning(false);
    }, 180);
    return () => {
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    };
  }, [pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === pathname) return;

      event.preventDefault();
      if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current);
      transitionRef.current = true;
      setIsTransitioning(true);

      const destination = `${url.pathname}${url.search}${url.hash}`;
      navigationTimer.current = window.setTimeout(() => {
        router.push(destination);
      }, TRANSITION_MS);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current);
    };
  }, [pathname, router]);

  if (!isTransitioning) return null;

  return (
    <div className="navigation-transition" aria-hidden="true">
      <div className="navigation-transition__glow" />
      <div className="navigation-transition__core">
        <div className="navigation-transition__ring">
          <span />
        </div>
        <div className="navigation-transition__progress">
          <span />
        </div>
      </div>
    </div>
  );
}
