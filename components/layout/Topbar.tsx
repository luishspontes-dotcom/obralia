"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  BriefcaseBusiness,
  Camera,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  FileArchive,
  FileText,
  HardHat,
  ListTodo,
  LogOut,
  Map,
  PenLine,
  Plus,
  Search,
  Settings,
  User,
  Users,
  Video,
} from "lucide-react";

export interface TopbarMenuCounts {
  fotos: number;
  videos: number;
  anexos: number;
  usuarios: number;
  gruposDeObra: number;
  modelosRelatorios: number;
  maoDeObra: number;
  equipamentos: number;
  tiposOcorrencias: number;
}

interface TopbarProps {
  activeOrg: { name: string } | null;
  userName: string | null;
  userEmail?: string | null;
  menuCounts?: TopbarMenuCounts | null;
}

export function Topbar({ activeOrg, userName, userEmail, menuCounts }: TopbarProps) {
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
        {/* No Diário de Obra, "Relatórios" do topo abre a caixa de notificações */}
        <TopbarLink href="/caixa" label="Relatórios" pathname={pathname} />
        <Menu
          label="Análise de dados"
          id="analise"
          active={pathname.startsWith("/inicio") || pathname.startsWith("/mapa") || pathname.startsWith("/analise-de-dados") || pathname.startsWith("/tarefas") || pathname.startsWith("/relatorios")}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        >
          <Link href="/inicio">
            <BarChart3 size={15} />
            Visão geral
          </Link>
          <Link href="/relatorios">
            <FileText size={15} />
            Relatórios criados
          </Link>
          <Link href="/caixa">
            <FileText size={15} />
            Aguardando aprovação
          </Link>
          <Link href="/tarefas">
            <ListTodo size={15} />
            Lista de tarefas
          </Link>
          <Link href="/analise-de-dados/fotos">
            <Camera size={15} />
            Fotos
            {menuCounts ? <em className="tnum">{menuCounts.fotos.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <Link href="/analise-de-dados/videos">
            <Video size={15} />
            Vídeos
            {menuCounts ? <em className="tnum">{menuCounts.videos.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <Link href="/analise-de-dados/anexos">
            <FileArchive size={15} />
            Anexos
            {menuCounts ? <em className="tnum">{menuCounts.anexos.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <Link href="/analise-de-dados/mao-de-obra">
            <HardHat size={15} />
            Mão de obra (histórico)
          </Link>
          <Link href="/analise-de-dados/equipamentos">
            <Settings size={15} />
            Equipamentos (histórico)
          </Link>
          <hr />
          <Link href="/mapa">
            <Map size={15} />
            Mapa das obras
          </Link>
        </Menu>
        <Menu
          label="Cadastros"
          id="cadastros"
          active={pathname.startsWith("/usuarios") || pathname.startsWith("/configuracoes") || pathname.startsWith("/cadastros")}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        >
          <Link href="/cadastros/meu-perfil">
            <User size={15} />
            Meu perfil
          </Link>
          <Link href="/cadastros/assinatura">
            <PenLine size={15} />
            Assinatura
          </Link>
          <Link href="/cadastros/empresa">
            <Building2 size={15} />
            Empresa
          </Link>
          <Link href="/usuarios">
            <Users size={15} />
            Usuários (login de acesso)
            {menuCounts ? <em className="tnum">{menuCounts.usuarios.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <hr />
          <Link href="/cadastros/grupos-de-obra">
            <BriefcaseBusiness size={15} />
            Grupos de obra
            {menuCounts ? <em className="tnum">{menuCounts.gruposDeObra.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <Link href="/cadastros/modelos-relatorios">
            <ClipboardList size={15} />
            Modelos de relatórios
            {menuCounts ? <em className="tnum">{menuCounts.modelosRelatorios.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <Link href="/cadastros/mao-de-obra">
            <HardHat size={15} />
            Mão de obra
            {menuCounts ? <em className="tnum">{menuCounts.maoDeObra.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <Link href="/cadastros/equipamentos">
            <Settings size={15} />
            Equipamentos
            {menuCounts ? <em className="tnum">{menuCounts.equipamentos.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <Link href="/cadastros/tipos-ocorrencias">
            <ClipboardList size={15} />
            Tipos de ocorrências
            {menuCounts ? <em className="tnum">{menuCounts.tiposOcorrencias.toLocaleString("pt-BR")}</em> : null}
          </Link>
          <Link href="/cadastros/checklist">
            <CheckSquare size={15} />
            Checklist
          </Link>
        </Menu>
        <Menu
          label="PT"
          id="idioma"
          active={false}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        >
          <Link href="#" title="Idioma atual">
            🇧🇷 Português (Brasil)
          </Link>
        </Menu>
      </nav>

      <nav className="do-topbar__actions" aria-label="Ações rápidas">
        <Link href="/buscar" className="do-icon-action" title="Pesquisar">
          <Search size={17} />
        </Link>
        <AddButton pathname={pathname} />
        <div className={`do-topbar-menu ${openMenu === "usuario" ? "is-open" : ""}`}>
          <button
            type="button"
            className="do-topbar-menu__trigger"
            aria-expanded={openMenu === "usuario"}
            aria-haspopup="menu"
            onClick={() => setOpenMenu(openMenu === "usuario" ? null : "usuario")}
            style={{ padding: "0 6px" }}
          >
            <span className="do-user-pill" title={userName ?? "Usuário"}>
              <span>{initials}</span>
              <strong>
                {userName ?? "Você"}
                {userEmail ? <span className="do-user-pill__email">{userEmail}</span> : null}
              </strong>
            </span>
            <ChevronDown size={14} />
          </button>
          <div className="do-topbar-menu__panel is-right" role="menu">
            <Link href="/configuracoes">
              <User size={15} />
              Meu perfil
            </Link>
            <form action="/auth/signout" method="post" style={{ display: "contents" }}>
              <button
                type="submit"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 10px",
                  color: "#333",
                  font: "500 13px var(--font-inter)",
                  background: "transparent",
                  border: 0,
                  width: "100%",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <LogOut size={15} />
                Sair
              </button>
            </form>
          </div>
        </div>
      </nav>
    </header>
  );
}

function AddButton({ pathname }: { pathname: string }) {
  let href = "/obras/nova";
  let label = "Adicionar";

  // Dentro de uma obra (/obras/[id]...) → adicionar relatório nessa obra
  const obraMatch = pathname.match(/^\/obras\/([^/]+)(?:\/|$)/);
  const obraId = obraMatch?.[1];

  if (obraId && obraId !== "nova") {
    href = `/obras/${obraId}/rdos/novo`;
    label = "Adicionar Relatório";
  } else if (pathname === "/obras" || pathname.startsWith("/obras")) {
    href = "/obras/nova";
    label = "Adicionar Obra";
  } else if (pathname.startsWith("/usuarios")) {
    href = "/usuarios#convidar";
    label = "Adicionar Usuário";
  }

  return (
    <Link href={href} className="do-add-button">
      <Plus size={16} />
      {label}
    </Link>
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
