"use client";

import { useState } from "react";
import { createOrUpdateTask, deleteTask } from "@/lib/rdo-actions";

type Props = {
  task: {
    id: string;
    name: string;
    status: string | null;
    due_date: string | null;
  };
  siteId: string;
};

const STATUS_LABELS: Record<string, string> = {
  waiting: "Aguardando",
  in_progress: "Em andamento",
  done: "Concluído",
  late: "Atrasado",
};

const STATUS_CLS: Record<string, string> = {
  waiting: "status-paused",
  in_progress: "status-progress",
  done: "status-done",
  late: "status-late",
};

export function TaskRow({ task, siteId }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const status = task.status ?? "waiting";
  const cls = STATUS_CLS[status] ?? "status-paused";
  const label = STATUS_LABELS[status] ?? "Aguardando";

  if (editing) {
    return (
      <form
        action={async (fd) => {
          setSaving(true);
          try { await createOrUpdateTask(fd); setEditing(false); }
          finally { setSaving(false); }
        }}
        style={{
          display: "grid", gridTemplateColumns: "1fr 110px 130px 90px 70px",
          gap: 8, padding: "10px 22px",
          borderTop: "1px solid var(--o-border)",
          background: "var(--t-brand-mist)",
          alignItems: "center",
        }}
      >
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="site_id" value={siteId} />
        <input name="name" required defaultValue={task.name}
          style={inlineInput} autoFocus />
        <input name="date_due" type="date" defaultValue={task.due_date ?? ""}
          style={inlineInput} />
        <select name="status" defaultValue={status} style={inlineInput}>
          <option value="waiting">Aguardando</option>
          <option value="in_progress">Em andamento</option>
          <option value="done">Concluído</option>
          <option value="late">Atrasado</option>
        </select>
        <button type="submit" disabled={saving} className="btn-brand"
          style={{ padding: "7px 10px", fontSize: 12, justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
          {saving ? "…" : "Salvar"}
        </button>
        <button type="button" onClick={() => setEditing(false)}
          style={{ padding: "7px 10px", fontSize: 12, border: "1px solid var(--o-border)", background: "white", borderRadius: 6, cursor: "pointer" }}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 22px", borderTop: "1px solid var(--o-border)", fontSize: 14,
    }}>
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          flex: 1, textAlign: "left", background: "transparent", border: 0,
          color: "var(--o-text-1)", cursor: "pointer", padding: 0, font: "inherit",
        }}
      >
        {task.name}
      </button>
      {task.due_date && (
        <span className="tnum" style={{
          fontSize: 12,
          color: status === "late" ? "var(--st-late)" : "var(--o-text-3)",
          fontWeight: status === "late" ? 500 : 400,
        }}>
          {new Date(task.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </span>
      )}
      <span className={`status ${cls}`} style={{ minWidth: 96, justifyContent: "center" }}>
        {label}
      </span>
      <button type="button" onClick={() => setEditing(true)} title="Editar"
        style={inlineActionBtn}>✎</button>
      <form action={deleteTask} style={{ display: "inline" }}>
        <input type="hidden" name="id" value={task.id} />
        <button type="submit" title="Remover" style={inlineActionBtn}>×</button>
      </form>
    </div>
  );
}

const inlineInput: React.CSSProperties = {
  width: "100%", background: "white",
  border: "1px solid var(--o-border)", borderRadius: 6,
  padding: "7px 10px", font: "400 13px var(--font-inter)",
  color: "var(--o-text-1)", outline: "none",
};

const inlineActionBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: "1px solid var(--o-border)",
  background: "transparent", color: "var(--o-text-3)", fontSize: 14,
  cursor: "pointer", lineHeight: 1, display: "grid", placeItems: "center",
};
