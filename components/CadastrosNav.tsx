"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User, CreditCard, Building2, Users, Layers, ClipboardList,
  HardHat, Wrench, AlertTriangle, CheckSquare,
} from "lucide-react";

export type CadastrosCounts = {
  usuarios: number;
  gruposDeObra: number;
  modelosRelatorios: number;
  maoDeObra: number;
  equipamentos: number;
  tiposOcorrencias: number;
};

type Item = { href: string; label: string; icon: React.ElementType; count?: number };

export function CadastrosNav({ counts }: { counts: CadastrosCounts }) {
  const pathname = usePathname();

  const sections: Array<{ title: string; items: Item[] }> = [
    {
      title: "Configurações",
      items: [
        { href: "/cadastros/meu-perfil", label: "Meu perfil", icon: User },
        { href: "/cadastros/assinatura", label: "Assinatura", icon: CreditCard },
        { href: "/cadastros/empresa", label: "Empresa", icon: Building2 },
        { href: "/usuarios", label: "Usuários (login de acesso)", icon: Users, count: counts.usuarios },
      ],
    },
    {
      title: "Pré-cadastro",
      items: [
        { href: "/cadastros/grupos-de-obra", label: "Grupos de obra", icon: Layers, count: counts.gruposDeObra },
        { href: "/cadastros/modelos-relatorios", label: "Modelos de relatórios", icon: ClipboardList, count: counts.modelosRelatorios },
        { href: "/cadastros/mao-de-obra", label: "Mão de obra", icon: HardHat, count: counts.maoDeObra },
        { href: "/cadastros/equipamentos", label: "Equipamentos", icon: Wrench, count: counts.equipamentos },
        { href: "/cadastros/tipos-ocorrencias", label: "Tipos de ocorrências", icon: AlertTriangle, count: counts.tiposOcorrencias },
        { href: "/cadastros/checklist", label: "Checklist", icon: CheckSquare },
      ],
    },
    {
      title: "Editar obra",
      items: [
        { href: "/cadastros/predefinir-mao-de-obra", label: "Predefinir mão de obra", icon: HardHat },
        { href: "/cadastros/predefinir-equipamentos", label: "Predefinir equipamentos", icon: Wrench },
      ],
    },
  ];

  const isActive = (href: string) =>
    href === "/usuarios" ? pathname.startsWith("/usuarios") : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="cadastros-nav" aria-label="Cadastros">
      {sections.map((section) => (
        <div key={section.title} className="cadastros-nav__section">
          <div className="cadastros-nav__title">{section.title}</div>
          {section.items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`cadastros-nav__item${active ? " is-active" : ""}`}
              >
                <Icon size={17} strokeWidth={2} />
                <span className="cadastros-nav__label">{item.label}</span>
                {typeof item.count === "number" && item.count > 0 && (
                  <span className="cadastros-nav__badge">{item.count}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
