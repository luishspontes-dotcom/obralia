"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Inbox,
  CircleCheck,
  Search,
  Settings,
  Map as MapIcon,
  Calendar,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

interface RailProps {
  userInitials: string;
}

export function Rail({ userInitials }: RailProps) {
  const pathname = usePathname();

  const items = [
    { href: "/inicio", icon: Home, label: "Início" },
    { href: "/caixa", icon: Inbox, label: "Caixa de entrada", badge: 0 },
    { href: "/tarefas", icon: CircleCheck, label: "Minhas tarefas" },
    { href: "/cronograma", icon: Calendar, label: "Cronograma" },
    { href: "/mapa", icon: MapIcon, label: "Mapa das obras" },
    { href: "/buscar", icon: Search, label: "Pesquisar" },
  ];

  return (
    <aside
      style={{
        background: "var(--o-dark)",
        color: "var(--o-text-on-dark)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 0",
        gap: 4,
        borderRight: "1px solid #2a2926",
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "var(--t-brand)",
          display: "grid",
          placeItems: "center",
          marginBottom: 12,
          boxShadow: "var(--shadow-brand)",
        }}
        title="Obralia"
      >
        <svg width={22} height={22} viewBox="0 0 32 32" fill="none">
          <circle cx={16} cy={16} r={11} stroke="white" strokeWidth={2.4} />
          <line
            x1={2.5}
            y1={16}
            x2={29.5}
            y2={16}
            stroke="white"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {items.map(({ href, icon: Icon, label, badge }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            title={label}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              color: active ? "var(--o-text-on-dark)" : "var(--o-text-2-on-dark)",
              background: active ? "rgba(255,255,255,.08)" : "transparent",
              position: "relative",
              transition: "200ms",
              textDecoration: "none",
            }}
          >
            <Icon size={20} />
            {badge ? (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  background: "var(--o-accent)",
                  color: "white",
                  borderRadius: 999,
                  font: "600 10px var(--font-inter)",
                  display: "grid",
                  placeItems: "center",
                  border: "2px solid var(--o-dark)",
                }}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}

      <div style={{ flex: 1 }} />

      <NotificationBell />

      <Link
        href="/configuracoes"
        title="Configurações"
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          color: "var(--o-text-2-on-dark)",
        }}
      >
        <Settings size={20} />
      </Link>

      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "linear-gradient(135deg, #08789B, #054F66)",
          display: "grid",
          placeItems: "center",
          font: "600 13px var(--font-inter)",
          color: "white",
        }}
      >
        {userInitials}
      </div>
    </aside>
  );
}
