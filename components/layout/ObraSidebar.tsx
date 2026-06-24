import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  ClipboardList,
  Calculator,
  Crosshair,
  FileText,
  Folder,
  LayoutDashboard,
  ListChecks,
  Pencil,
  Ruler,
  Search,
  Video,
} from "lucide-react";
import { mediaUrl } from "@/lib/storage";

type ActiveSection = "overview" | "tasks" | "reports" | "medicoes" | "photos" | "budget" | "edit";

type ObraSidebarProps = {
  site: {
    id: string;
    name: string;
    cover_url: string | null;
  };
  counts: {
    reports?: number;
    tasks?: number;
    photos?: number;
    videos?: number;
    files?: number;
    estimates?: number;
    medicoes?: number;
  };
  active: ActiveSection;
};

export function ObraSidebar({ site, counts, active }: ObraSidebarProps) {
  return (
    <aside className="do-obra-sidebar">
      <Link href="/obras" className="do-obra-back" title="Voltar">
        <ArrowLeft size={18} />
      </Link>

      <div
        className="do-obra-sidebar__cover"
        style={{
          backgroundImage: site.cover_url ? `url(${mediaUrl(site.cover_url)})` : undefined,
        }}
      />

      <nav className="do-obra-sidebar__nav" aria-label={`Navegação da obra ${site.name}`}>
        <SideLink
          href={`/obras/${site.id}`}
          active={active === "overview"}
          icon={<LayoutDashboard size={16} />}
          label="Visão geral"
        />
        <SideLink
          href={`/obras/${site.id}/tarefas`}
          active={active === "tasks"}
          icon={<ListChecks size={16} />}
          label="Lista de tarefas"
          count={counts.tasks}
          badgeTone="blue"
        />
        <SideLink
          href={`/obras/${site.id}/rdos`}
          active={active === "reports"}
          icon={<FileText size={16} />}
          label="Relatórios"
          count={counts.reports}
          badgeTone="gray"
        />
        <div className="do-side-group">
          <div className="do-side-group__label">
            <Search size={15} />
            Filtro de busca
          </div>
          <SideLink
            href={`/obras/${site.id}/fotos`}
            active={active === "photos"}
            icon={<Camera size={16} />}
            label="Fotos"
            count={counts.photos}
            nested
          />
          <SideLink
            href={`/obras/${site.id}/fotos?tipo=video`}
            active={false}
            icon={<Video size={16} />}
            label="Vídeos"
            count={counts.videos}
            nested
          />
          <SideLink
            href={`/obras/${site.id}/tarefas`}
            active={false}
            icon={<ClipboardList size={16} />}
            label="Atividades"
            count={counts.tasks}
            nested
          />
          <SideLink
            href={`/obras/${site.id}#documentos`}
            active={false}
            icon={<Folder size={16} />}
            label="Documentos"
            count={counts.files}
            nested
          />
        </div>
        <div className="do-side-group">
          <div className="do-side-group__label">Obralia</div>
          <SideLink
            href={`/obras/${site.id}/medicoes`}
            active={active === "medicoes"}
            icon={<Ruler size={16} />}
            label="Medições"
            count={counts.medicoes}
            nested
          />
          <SideLink
            href={`/obras/${site.id}/orcamento-ia`}
            active={active === "budget"}
            icon={<Calculator size={16} />}
            label="Orçamento IA"
            count={counts.estimates}
            nested
          />
          <SideLink
            href={`/obras/${site.id}#risco-de-atraso`}
            active={false}
            icon={<Crosshair size={16} />}
            label="Risco de atraso"
            nested
          />
        </div>
        <SideLink
          href={`/obras/${site.id}/editar`}
          active={active === "edit"}
          icon={<Pencil size={16} />}
          label="Editar obra"
        />
      </nav>
    </aside>
  );
}

function SideLink({
  href,
  active,
  icon,
  label,
  count,
  nested = false,
  badgeTone,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  nested?: boolean;
  /** Cor fixa do badge (Diário: Lista de tarefas azul, Relatórios cinza). */
  badgeTone?: "blue" | "gray";
}) {
  const badgeStyle: React.CSSProperties | undefined =
    badgeTone === "blue" ? { background: "#2196F3", color: "#fff" }
      : badgeTone === "gray" ? { background: "#e2e5ea", color: "#5f6673" }
      : undefined;
  return (
    <Link className={`do-side-link ${active ? "is-active" : ""} ${nested ? "is-nested" : ""}`} href={href}>
      {icon}
      <span>{label}</span>
      {typeof count === "number" ? <em style={badgeStyle}>{count}</em> : null}
    </Link>
  );
}
