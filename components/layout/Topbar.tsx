"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Search } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/inicio": "Início",
  "/caixa": "Caixa de entrada",
  "/tarefas": "Minhas tarefas",
  "/comentarios": "Comentários",
  "/buscar": "Pesquisar",
  "/obras": "Obras",
  "/usuarios": "Usuários",
  "/configuracoes": "Configurações",
};

interface TopbarProps {
  activeOrg: { name: string } | null;
  userName: string | null;
}

export function Topbar({ activeOrg, userName }: TopbarProps) {
  const pathname = usePathname();
  const pageTitle =
    PAGE_TITLES[pathname] ??
    (pathname.startsWith("/obras") ? "Obras" : undefined) ??
    (pathname.startsWith("/canal") ? "Canal" : "Obralia");

  return (
    <header className="app-topbar">
      <div className="app-topbar__context">
        <div className="app-topbar__title">{pageTitle}</div>
        <div className="app-topbar__meta">
          {activeOrg?.name ?? "Workspace"} · {userName ?? "Você"}
        </div>
      </div>

      <nav className="app-topbar__actions" aria-label="Ações rápidas">
        <Link className="icon-button" href="/buscar" title="Pesquisar">
          <Search size={18} />
        </Link>
        <Link className="icon-button" href="/caixa" title="Caixa de entrada">
          <Bell size={18} />
        </Link>
        <form action="/auth/signout" method="post">
          <button className="icon-button" type="submit" title="Sair">
            <LogOut size={18} />
          </button>
        </form>
      </nav>
    </header>
  );
}
