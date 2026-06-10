"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  HardHat,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * Barra de abas inferior (mobile < 768px), espelhando o app
 * nativo do Diário de Obra:
 *  - Global:        Obras · Relatórios · ＋ (criar RDO) · Análise · Menu
 *  - Dentro da obra: Visão geral · Lista de tarefas · Relatórios · Menu
 * Visível apenas em viewports estreitos (CSS .do-mobile-tabbar).
 * ───────────────────────────────────────────────────────────── */

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
};

export function MobileTabBar({ recentSiteId }: { recentSiteId: string | null }) {
  const pathname = usePathname();

  // Não cobre telas de impressão
  if (pathname.includes("/imprimir")) return null;

  const obraMatch = pathname.match(/^\/obras\/([^/]+)/);
  const obraId = obraMatch && obraMatch[1] !== "nova" ? obraMatch[1] : null;

  if (obraId) {
    const tabs: Tab[] = [
      {
        href: `/obras/${obraId}`,
        label: "Visão geral",
        icon: <LayoutDashboard size={20} />,
        active: pathname === `/obras/${obraId}`,
      },
      {
        href: `/obras/${obraId}/tarefas`,
        label: "Lista de tarefas",
        icon: <ListChecks size={20} />,
        active: pathname.startsWith(`/obras/${obraId}/tarefas`),
      },
      {
        href: `/obras/${obraId}/rdos`,
        label: "Relatórios",
        icon: <FileText size={20} />,
        active: pathname.startsWith(`/obras/${obraId}/rdos`),
      },
      {
        href: `/obras/${obraId}/editar`,
        label: "Menu",
        icon: <Menu size={20} />,
        active: pathname.startsWith(`/obras/${obraId}/editar`),
      },
    ];
    return (
      <nav className="do-mobile-tabbar" aria-label="Navegação da obra">
        {tabs.map((tab) => (
          <TabLink key={tab.label} tab={tab} />
        ))}
      </nav>
    );
  }

  const fabHref = recentSiteId ? `/obras/${recentSiteId}/rdos/novo` : "/obras";

  return (
    <nav className="do-mobile-tabbar" aria-label="Navegação principal">
      <TabLink
        tab={{
          href: "/obras",
          label: "Obras",
          icon: <HardHat size={20} />,
          active: pathname === "/obras" || pathname.startsWith("/obras/"),
        }}
      />
      <TabLink
        tab={{
          href: "/relatorios",
          label: "Relatórios",
          icon: <FileText size={20} />,
          active: pathname.startsWith("/relatorios"),
        }}
      />
      <Link href={fabHref} className="do-mobile-tabbar__fab" aria-label="Criar relatório (RDO)">
        <Plus size={26} />
      </Link>
      <TabLink
        tab={{
          href: "/analise-de-dados",
          label: "Análise",
          icon: <BarChart3 size={20} />,
          active: pathname.startsWith("/analise-de-dados") || pathname.startsWith("/inicio"),
        }}
      />
      <TabLink
        tab={{
          href: "/cadastros",
          label: "Menu",
          icon: <Menu size={20} />,
          active: pathname.startsWith("/cadastros") || pathname.startsWith("/configuracoes") || pathname.startsWith("/usuarios"),
        }}
      />
    </nav>
  );
}

function TabLink({ tab }: { tab: Tab }) {
  return (
    <Link href={tab.href} className={`do-mobile-tabbar__item ${tab.active ? "is-active" : ""}`}>
      {tab.icon}
      <span>{tab.label}</span>
    </Link>
  );
}
