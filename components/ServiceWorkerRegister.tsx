"use client";

import { useEffect } from "react";

const ServiceWorkerRegister = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed.", error);
      });
    };

    window.addEventListener("load", onLoad);

    return () => {
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
};

export default ServiceWorkerRegister;
