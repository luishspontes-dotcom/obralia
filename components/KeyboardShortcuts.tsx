"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Atalhos globais. Por enquanto:
 *   n  →  novo RDO da obra atual (ou /obras se não estiver em uma)
 *   /  →  foca no campo de busca (futuro)
 *
 * Não dispara quando o foco está em <input>, <textarea> ou contentEditable.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n" || e.key === "N") {
        // Match /obras/{id}
        const m = pathname.match(/^\/obras\/([^/]+)/);
        if (m && m[1] !== "nova") {
          e.preventDefault();
          router.push(`/obras/${m[1]}/rdos/novo`);
        } else {
          e.preventDefault();
          router.push("/obras");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return null;
}
