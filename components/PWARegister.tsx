"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const onLoad = () => {
      // updateViaCache: "none" garante que o sw.js v2 seja buscado fresco
      // (sem ficar preso na versão antiga pelo cache HTTP).
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => null);
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
