import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CloudDownload, ListOrdered, Plus, Search } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { PrintButton } from "@/components/PrintButton";
import { createServerSupabase } from "@/lib/supabase/server";
import { createOrUpdateTask, deleteTask } from "@/lib/rdo-actions";
import { getCurrentRole, canWrite } from "@/lib/permissions";
import { VISIBLE_SOURCE_PROVIDERS, WBS_SOURCE_PROVIDERS, MEDIA_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

type Site = {
  id: string;
  name: string;
  cover_url: string | null;
};

type WbsItem = {
  id: string;
  parent_id: string | null;
  name: string;
  code: string | null;
  status: string | null;
  position: number | null;
  progress_pct: number | null;
  due_date: string | null;
};

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  waiting: { label: "Não iniciada", cls: "is-planned" },
  todo: { label: "Não iniciada", cls: "is-planned" },
  in_progress: { label: "Em andamento", cls: "" },
  done: { label: "Concluída", cls: "is-done" },
  late: { label: "Atrasada", cls: "is-late" },
  paused: { label: "Pausada", cls: "is-paused" },
};

function taskProgress(task: WbsItem): number {
  if (task.progress_pct != null) return Math.min(Math.max(task.progress_pct, 0), 100);
  return task.status === "done" ? 100 : 0;
}

export default async function ObraTarefasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string; etapas?: string; ocultar?: string; edit?: string }>;
}) {
  const { id } = await params;
  const { q, status: rawStatus, etapas, ocultar, edit } = await searchParams;
  const queryText = (q ?? "").trim().toLowerCase();
  const statusFilter =
    rawStatus && ["waiting", "in_progress", "done", "late"].includes(rawStatus) ? rawStatus : undefined;
  const onlyPhases = etapas === "1";
  const hideDonePhases = ocultar === "1";

  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, cover_url")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const [{ data: itemsRaw }, { count: reportCount }, { count: photoCount }, { count: videoCount }, { count: fileCount }] =
    await Promise.all([
      supabase
        .from("wbs_items")
        .select("id, parent_id, name, code, status, position, progress_pct, due_date")
        .eq("site_id", id)
        .in("external_provider", WBS_SOURCE_PROVIDERS)
        .order("position"),
      supabase
        .from("daily_reports")
        .select("*", { count: "exact", head: true })
        .eq("site_id", id)
        .in("external_provider", VISIBLE_SOURCE_PROVIDERS),
      supabase
        .from("media")
        .select("*", { count: "exact", head: true })
        .eq("site_id", id)
        .in("external_provider", MEDIA_SOURCE_PROVIDERS)
        .eq("kind", "photo"),
      supabase
        .from("media")
        .select("*", { count: "exact", head: true })
        .eq("site_id", id)
        .in("external_provider", MEDIA_SOURCE_PROVIDERS)
        .eq("kind", "video"),
      supabase
        .from("media")
        .select("*", { count: "exact", head: true })
        .eq("site_id", id)
        .in("external_provider", MEDIA_SOURCE_PROVIDERS)
        .eq("kind", "file"),
    ]);

  const items = (itemsRaw ?? []) as WbsItem[];
  const phases = items
    .filter((item) => item.parent_id === null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const allTasks = items.filter((item) => item.parent_id !== null);
  const tasksByPhase = new Map<string, WbsItem[]>();
  for (const task of allTasks) {
    const list = tasksByPhase.get(task.parent_id ?? "") ?? [];
    list.push(task);
    tasksByPhase.set(task.parent_id ?? "", list);
  }
  for (const list of tasksByPhase.values()) {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  // Contadores (sempre sobre o conjunto completo, como no Diário)
  const total = allTasks.length;
  const notStarted = allTasks.filter((t) => t.status === "waiting" || t.status === "todo" || t.status == null).length;
  const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
  const done = allTasks.filter((t) => t.status === "done").length;
  const realizadoPct = total > 0
    ? allTasks.reduce((sum, t) => sum + taskProgress(t), 0) / total
    : 0;

  const role = await getCurrentRole();
  const canEdit = canWrite(role);

  const matchesFilters = (task: WbsItem): boolean => {
    if (queryText && !task.name.toLowerCase().includes(queryText)) return false;
    if (statusFilter) {
      const st = task.status ?? "waiting";
      if (statusFilter === "waiting" && !(st === "waiting" || st === "todo")) return false;
      if (statusFilter !== "waiting" && st !== statusFilter) return false;
    }
    return true;
  };

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="tasks"
        counts={{
          reports: reportCount ?? 0,
          tasks: total,
          photos: photoCount ?? 0,
          videos: videoCount ?? 0,
          files: fileCount ?? 0,
        }}
      />

      <main className="do-obra-main">
        <div className="diario-container">
          {/* Header + botões: ≡ Reordenar · ☁ Importar · + Adicionar */}
          <div className="diario-page-header">
            <div>
              <h1>Lista de tarefas</h1>
              <p>{site.name} · inclui as etapas da obra e as atividades do cronograma (Asana/ClickUp)</p>
            </div>
            <div className="diario-toolbar">
              <button type="button" className="diario-gray-button" title="Em breve">
                <ListOrdered size={15} />
                Reordenar
              </button>
              <Link href={`/obras/${id}/orcamento-ia`} className="diario-red-button" title="Importar do Orçamento IA">
                <CloudDownload size={15} />
                Importar
              </Link>
              <Link href="#nova-tarefa" className="diario-blue-button">
                <Plus size={15} />
                Adicionar
              </Link>
            </div>
          </div>

          {/* Painel de filtros */}
          <section className="do-panel" style={{ marginBottom: 16 }}>
            <form
              method="get"
              action={`/obras/${id}/tarefas`}
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px" }}
            >
              <input className="diario-input" type="search" name="q" defaultValue={q ?? ""} placeholder="Pesquisa" />
              <select className="diario-select" name="status" defaultValue={statusFilter ?? ""}>
                <option value="">Todas as tarefas</option>
                <option value="waiting">Não iniciadas</option>
                <option value="in_progress">Em andamento</option>
                <option value="done">Concluídas</option>
                <option value="late">Atrasadas</option>
              </select>
              <label className="diario-checkbox">
                <input type="checkbox" name="etapas" value="1" defaultChecked={onlyPhases} />
                Exibir somente as etapas
              </label>
              <label className="diario-checkbox">
                <input type="checkbox" name="ocultar" value="1" defaultChecked={hideDonePhases} />
                Ocultar etapas concluídas
              </label>
              <button className="diario-blue-button" type="submit" title="Pesquisar">
                <Search size={16} />
              </button>
              <span style={{ marginLeft: "auto" }}>
                <PrintButton label="🖨 Imprimir" className="diario-gray-button" />
              </span>
            </form>
          </section>

          {/* 5 contadores */}
          <div className="do-task-counter-grid">
            <Counter value={String(total)} label="Total" />
            <Counter value={String(notStarted)} label="Não iniciada" />
            <Counter value={String(inProgress)} label="Em andamento" />
            <Counter value={String(done)} label="Concluída" />
            <Counter value={`${realizadoPct.toFixed(2)}%`} label="% Realizado" />
          </div>

          {/* EAP */}
          <section className="do-panel">
            <div className="do-table-wrap">
              <table className="do-table">
                <tbody>
                  {phases.map((phase, phaseIndex) => {
                    const phaseTasks = (tasksByPhase.get(phase.id) ?? []).filter(matchesFilters);
                    const allPhaseTasks = tasksByPhase.get(phase.id) ?? [];
                    const phasePct = allPhaseTasks.length > 0
                      ? allPhaseTasks.reduce((sum, t) => sum + taskProgress(t), 0) / allPhaseTasks.length
                      : taskProgress(phase);
                    if (hideDonePhases && phasePct >= 100) return null;
                    if (queryText && phaseTasks.length === 0 && !phase.name.toLowerCase().includes(queryText)) {
                      return null;
                    }
                    const phaseCode = phase.code ?? `${phaseIndex + 1}.0`;
                    return (
                      <Fragment key={phase.id}>
                        <tr className="do-task-phase">
                          <td className="tnum" style={{ width: 64 }}>{phaseCode}</td>
                          <td colSpan={3}>{phase.name}</td>
                          <td className="tnum" style={{ textAlign: "right" }}>{phasePct.toFixed(2)}%</td>
                          <td style={{ width: 70 }} />
                        </tr>
                        {!onlyPhases && phaseTasks.map((task, taskIndex) => {
                          const meta = TASK_STATUS[task.status ?? "waiting"] ?? TASK_STATUS.waiting;
                          const pct = taskProgress(task);
                          const taskCode = task.code ?? `${phaseIndex + 1}.${taskIndex + 1}`;
                          if (edit === task.id && canEdit) {
                            return (
                              <tr key={task.id} id={`task-${task.id}`} style={{ background: "#f0f6ff" }}>
                                <td className="tnum">{taskCode}</td>
                                <td colSpan={5}>
                                  <form
                                    action={createOrUpdateTask}
                                    style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                                  >
                                    <input type="hidden" name="id" value={task.id} />
                                    <input type="hidden" name="site_id" value={id} />
                                    <input className="diario-input" name="name" required defaultValue={task.name} style={{ flex: "1 1 220px" }} />
                                    <input className="diario-input" name="date_due" type="date" defaultValue={task.due_date ?? ""} style={{ minWidth: 130 }} />
                                    <input className="diario-input tnum" name="progress_pct" type="number" min={0} max={100} defaultValue={pct} title="% concluída" style={{ minWidth: 70 }} />
                                    <select className="diario-select" name="status" defaultValue={task.status ?? "waiting"} style={{ minWidth: 130 }}>
                                      <option value="waiting">Não iniciada</option>
                                      <option value="in_progress">Em andamento</option>
                                      <option value="done">Concluída</option>
                                      <option value="late">Atrasada</option>
                                    </select>
                                    <button type="submit" className="diario-blue-button">Salvar</button>
                                    <Link href={`/obras/${id}/tarefas`} className="diario-gray-button">Cancelar</Link>
                                  </form>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={task.id} id={`task-${task.id}`}>
                              <td className="tnum">{taskCode}</td>
                              <td>{task.name}</td>
                              <td style={{ width: 60 }}>1 vb</td>
                              <td style={{ width: 150 }}>
                                <span className="tnum" style={{ marginRight: 8 }}>{pct.toFixed(0)}%</span>
                                <span className="do-task-progress" style={{ display: "inline-block", verticalAlign: "middle" }}>
                                  <span style={{ width: `${pct}%` }} />
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <span className={`diario-status-badge ${meta.cls}`}>{meta.label}</span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {canEdit ? (
                                  <span className="do-row-actions">
                                    <Link
                                      href={`/obras/${id}/tarefas?edit=${task.id}#task-${task.id}`}
                                      title="Editar"
                                      style={{ color: "#d32f2f" }}
                                    >
                                      ✏
                                    </Link>
                                    <form action={deleteTask} style={{ display: "inline" }}>
                                      <input type="hidden" name="id" value={task.id} />
                                      <input type="hidden" name="site_id" value={id} />
                                      <button type="submit" title="Excluir">✕</button>
                                    </form>
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                  {phases.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Esta obra ainda não tem lista de tarefas.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {/* + Adicionar — formulário de nova tarefa */}
          {canEdit ? (
            <section id="nova-tarefa" className="do-panel" style={{ marginTop: 16 }}>
              <div className="do-panel__header">
                <h2>Adicionar tarefa</h2>
              </div>
              <form
                action={createOrUpdateTask}
                style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "12px" }}
              >
                <input type="hidden" name="site_id" value={id} />
                <input className="diario-input" name="name" required placeholder="Nome da tarefa" style={{ flex: "1 1 260px" }} />
                <input className="diario-input" name="date_due" type="date" style={{ minWidth: 140 }} />
                <select className="diario-select" name="status" defaultValue="waiting" style={{ minWidth: 140 }}>
                  <option value="waiting">Não iniciada</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="done">Concluída</option>
                </select>
                <button type="submit" className="diario-blue-button">
                  <Plus size={15} />
                  Adicionar
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Counter({ value, label }: { value: string; label: string }) {
  return (
    <div className="do-metric-card">
      <span>
        <strong className="tnum">{value}</strong>
        {label}
      </span>
    </div>
  );
}
