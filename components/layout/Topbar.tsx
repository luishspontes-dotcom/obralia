"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  Camera,
  ChevronDown,
  ClipboardList,
  FileArchive,
  FileText,
  HardHat,
  ListTodo,
  LogOut,
  Map,
  Plus,
  Search,
  Settings,
  UserCog,
  Users,
  Video,
} from "lucide-react";

interface TopbarProps {
  activeOrg: { name: string } | null;
  userName: string | null;
}

export function Topbar({ activeOrg, userName }: TopbarProps) {
  const pathname = usePathname();
  const topbarRef = useRef<HTMLElement | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const initials = (userName ?? "LU")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!topbarRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="do-topbar" ref={topbarRef}>
      <Link href="/obras" className="do-topbar__brand" title={activeOrg?.name ?? "Obralia"}>
        {activeOrg?.name ?? "MEU VIVER CONSTRUTORA E INCORPORADORA LTDA"}
      </Link>

      <nav className="do-topbar__nav" aria-label="Navegação principal">
        <TopbarLink href="/obras" label="Obras" pathname={pathname} />
        <TopbarLink href="/relatorios" label="Relatórios" pathname={pathname} />
        <Menu
          label="Análise de dados"
          id="analise"
          active={pathname.startsWith("/inicio") || pathname.startsWith("/mapa") || pathname.startsWith("/analise-de-dados") || pathname.startsWith("/tarefas") || pathname.startsWith("/caixa")}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        >
          <Link href="/inicio">
            <BarChart3 size={15} />
            Visão geral
          </Link>
          <Link href="/mapa">
            <Map size={15} />
            Mapa das obras
          </Link>
          <Link href="/relatorios">
            <FileText size={15} />
            Relatórios criados
          </Link>
          <Link href="/caixa">
            <FileText size={15} />
            Relatórios aguardando aprovação
          </Link>
          <Link href="/tarefas">
            <ListTodo size={15} />
            Lista de tarefas
          </Link>
          <Link href="/analise-de-dados/fotos">
            <Camera size={15} />
            Fotos
          </Link>
          <Link href="/analise-de-dados/videos">
            <Video size={15} />
            Vídeos
          </Link>
          <Link href="/analise-de-dados/anexos">
            <FileArchive size={15} />
            Anexos
          </Link>
        </Menu>
        <Menu
          label="Cadastros"
          id="cadastros"
          active={pathname.startsWith("/usuarios") || pathname.startsWith("/configuracoes") || pathname.startsWith("/cadastros")}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        >
          <Link href="/usuarios">
            <Users size={15} />
            Usuários
          </Link>
          <Link href="/cadastros/usuarios-empresas-acesso">
            <UserCog size={15} />
            Usuários empresas/acesso
          </Link>
          <Link href="/cadastros/grupos-de-obra">
            <BriefcaseBusiness size={15} />
            Grupos de obra
          </Link>
          <Link href="/cadastros/modelos-relatorios">
            <ClipboardList size={15} />
            Modelos de relatórios
          </Link>
          <Link href="/cadastros/mao-de-obra">
            <HardHat size={15} />
            Mão de obra
          </Link>
          <Link href="/cadastros/equipamentos">
            <Settings size={15} />
            Equipamentos
          </Link>
          <Link href="/cadastros/tipos-ocorrencias">
            <ClipboardList size={15} />
            Tipos de ocorrências
          </Link>
          <Link href="/configuracoes">
            <Settings size={15} />
            Configurações
          </Link>
        </Menu>
      </nav>

      <nav className="do-topbar__actions" aria-label="Ações rápidas">
        <Link href="/buscar" className="do-icon-action" title="Pesquisar">
          <Search size={17} />
        </Link>
        <Link href="/obras/nova" className="do-add-button">
          <Plus size={16} />
          Adicionar
        </Link>
        <div className="do-user-pill" title={userName ?? "Usuário"}>
          <span>{initials}</span>
          <strong>{userName ?? "Você"}</strong>
        </div>
        <form action="/auth/signout" method="post">
          <button className="do-icon-action" type="submit" title="Sair">
            <LogOut size={17} />
          </button>
        </form>
      </nav>
    </header>
  );
}

function TopbarLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={active ? "is-active" : undefined}>
      {label}
    </Link>
  );
}

function Menu({
  id,
  label,
  active,
  openMenu,
  setOpenMenu,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  children: React.ReactNode;
}) {
  const isOpen = openMenu === id;

  return (
    <div className={`do-topbar-menu ${active ? "is-active" : ""} ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="do-topbar-menu__trigger"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setOpenMenu(isOpen ? null : id)}
      >
        {label}
        <ChevronDown size={14} />
      </button>
      <div
        className="do-topbar-menu__panel"
        role="menu"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) {
            setOpenMenu(null);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
