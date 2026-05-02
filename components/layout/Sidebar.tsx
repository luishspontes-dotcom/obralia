"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Inbox,
  CircleCheck,
  MessageSquare,
  Building2,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Hash,
  ChevronsUpDown,
  Users,
} from "lucide-react";

interface SidebarProps {
  activeOrg: { id: string; name: string; slug: string; brand_color: string | null } | null;
  userName: string | null;
  canManageSites?: boolean;
  canManageUsers?: boolean;
}

export function Sidebar({ activeOrg, userName, canManageSites = true, canManageUsers = true }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="dark-scroll"
      style={{
        background: "var(--o-dark-2)",
        color: "var(--o-text-on-dark)",
        padding: "14px 8px",
        borderRight: "1px solid #2a2926",
        overflowY: "auto",
        maxHeight: "100vh",
      }}
    >
      {/* Workspace pill — uses tenant brand_color */}
      {activeOrg && (
        <div
          style={{
            margin: "6px 0 4px",
            padding: 12,
            background: activeOrg.brand_color
              ? `${activeOrg.brand_color}1F`
              : "rgba(8, 120, 155, 0.12)",
            border: `1px solid ${activeOrg.brand_color ? `${activeOrg.brand_color}55` : "rgba(8, 120, 155, 0.3)"}`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 8,
              height: 28,
              borderRadius: 2,
              background: activeOrg.brand_color ?? "var(--t-brand)",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: "600 13px var(--font-inter)",
                color: "var(--o-text-on-dark)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: "-0.01em",
              }}
            >
              {activeOrg.name}
            </div>
            <div
              style={{
                font: "500 11px var(--font-inter)",
                color: "var(--o-text-3)",
              }}
            >
              workspace
            </div>
          </div>
          <ChevronsUpDown size={14} color="var(--o-text-3)" />
        </div>
      )}

      <SectionHeading>Personal</SectionHeading>
      <NavItem href="/inicio" icon={Home} label="Início" pathname={pathname} />
      <NavItem href="/caixa" icon={Inbox} label="Caixa de entrada" pathname={pathname} />
      <NavItem href="/tarefas" icon={CircleCheck} label="Minhas tarefas" pathname={pathname} />
      <NavItem href="/comentarios" icon={MessageSquare} label="Comentários" pathname={pathname} />

      <SectionHeading>Obras</SectionHeading>
      <NavItem
        href="/obras?status=in_progress"
        icon={Building2}
        label="Em andamento"
        pathname={pathname}
        accent="var(--st-progress)"
      />
      <NavItem
        href="/obras?status=done"
        icon={CheckCircle2}
        label="Concluídas"
        pathname={pathname}
        accent="var(--st-done)"
      />
      <NavItem
        href="/obras?status=at-risk"
        icon={AlertTriangle}
        label="Em risco"
        pathname={pathname}
        accent="var(--st-late)"
      />

      {canManageSites && (
        <Link
          href="/obras/nova"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            marginTop: 12,
            color: "var(--o-accent)",
            fontSize: 14,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <PlusCircle size={16} /> Nova obra
        </Link>
      )}

      <SectionHeading>Canais</SectionHeading>
      <NavItem href="/canal/geral" icon={Hash} label="Geral" pathname={pathname} small />
      <NavItem href="/canal/engenharia" icon={Hash} label="Engenharia" pathname={pathname} small />

      {canManageUsers && (
        <>
          <SectionHeading>Admin</SectionHeading>
          <NavItem href="/usuarios" icon={Users} label="Usuários" pathname={pathname} />
        </>
      )}

      <div
        style={{
          marginTop: 32,
          padding: "12px",
          fontSize: 11,
          color: "var(--o-text-3)",
        }}
      >
        Logado como{" "}
        <span style={{ color: "var(--o-text-on-dark)", fontWeight: 500 }}>
          {userName ?? "Você"}
        </span>
      </div>
    </aside>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        margin: "14px 0 6px",
        font: "600 11px var(--font-inter)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--o-text-3)",
      }}
    >
      {children}
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  pathname,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  pathname: string;
  accent?: string;
  small?: boolean;
}) {
  const active = pathname === href.split("?")[0] || pathname.startsWith(href.split("?")[0] + "/");
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 8,
        color: active ? "var(--o-text-on-dark)" : "var(--o-text-2-on-dark)",
        background: active ? "rgba(8, 120, 155, 0.18)" : "transparent",
        borderLeft: active ? "3px solid var(--t-brand)" : "3px solid transparent",
        paddingLeft: active ? 9 : 12,
        fontSize: 14,
        textDecoration: "none",
        transition: "200ms",
      }}
    >
      <Icon size={16} color={accent ?? undefined} />
      {label}
    </Link>
  );
}
