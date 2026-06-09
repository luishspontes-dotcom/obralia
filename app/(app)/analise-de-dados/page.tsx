import Link from "next/link";
import { Camera, FileArchive, FileText, ListTodo, Map, Video } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

export default async function AnaliseDeDadosPage() {
  const supabase = await createServerSupabase();
  const [
    { count: reports },
    { count: reviewReports },
    { count: tasks },
    { count: photos },
    { count: videos },
    { count: files },
  ] = await Promise.all([
    supabase.from("daily_reports").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS),
    supabase.from("daily_reports").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS).eq("status", "review"),
    supabase.from("wbs_items").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS).not("parent_id", "is", null),
    supabase.from("media").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS).eq("kind", "photo"),
    supabase.from("media").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS).eq("kind", "video"),
    supabase.from("media").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS).eq("kind", "file"),
  ]);

  const cards = [
    { href: "/inicio", label: "Visão geral", value: reports ?? 0, icon: FileText },
    { href: "/mapa", label: "Mapa das obras", value: "", icon: Map },
    { href: "/relatorios", label: "Relatórios criados", value: reports ?? 0, icon: FileText },
    { href: "/caixa", label: "Relatórios aguardando aprovação", value: reviewReports ?? 0, icon: FileText },
    { href: "/tarefas", label: "Lista de tarefas", value: tasks ?? 0, icon: ListTodo },
    { href: "/analise-de-dados/fotos", label: "Fotos", value: photos ?? 0, icon: Camera },
    { href: "/analise-de-dados/videos", label: "Vídeos", value: videos ?? 0, icon: Video },
    { href: "/analise-de-dados/anexos", label: "Anexos", value: files ?? 0, icon: FileArchive },
  ];

  return (
    <div className="diario-page">
      <div className="diario-container">
        <div className="diario-page-header">
          <div>
            <h1>Análise de dados</h1>
            <p>Indicadores e galerias globais da operação</p>
          </div>
        </div>
        <div className="do-cadastro-grid">
          {cards.map(({ href, label, value, icon: Icon }) => (
            <Link key={href} href={href} className="do-cadastro-card">
              <Icon size={18} />
              <span>{label}</span>
              <strong>{value}</strong>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
