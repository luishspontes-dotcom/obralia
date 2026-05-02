"use client";

import { useState } from "react";
import { createOrUpdateRdo } from "@/lib/rdo-actions";

type WF = { role: string; count: number };
type EQ = { name: string; hours: number | null };
type AC = { description: string; progress_pct: number | null; notes: string | null };

export type RdoFormProps = {
  siteId: string;
  rdoId?: string | null;
  initial?: {
    date?: string;
    status?: string;
    weather_morning?: string | null;
    weather_afternoon?: string | null;
    condition_morning?: string | null;
    condition_afternoon?: string | null;
    general_notes?: string | null;
    workforce?: WF[];
    equipment?: EQ[];
    activities?: AC[];
  };
};

const ROLES_DEFAULT = [
  "Engenheiro", "Mestre de Obra", "Encarregado", "Pedreiro", "Servente",
  "Ajudante", "Carpinteiro", "Eletricista", "Encanador", "Pintor",
  "Armador", "Soldador", "Estagiário", "Outros",
];

const CLIMAS = ["", "Claro", "Parcialmente nublado", "Nublado", "Chuvoso", "Garoa", "Sol forte"];
const CONDICOES = ["", "Praticável", "Impraticável", "Parcial"];

export function RdoForm(props: RdoFormProps) {
  const isEdit = !!props.rdoId;
  const ini = props.initial ?? {};

  const [date, setDate] = useState(ini.date ?? new Date().toISOString().slice(0, 10));
  const [wm, setWm] = useState(ini.weather_morning ?? "");
  const [wa, setWa] = useState(ini.weather_afternoon ?? "");
  const [cm, setCm] = useState(ini.condition_morning ?? "");
  const [ca, setCa] = useState(ini.condition_afternoon ?? "");
  const [notes, setNotes] = useState(ini.general_notes ?? "");
  const [status, setStatus] = useState(ini.status ?? "draft");

  const [workforce, setWorkforce] = useState<WF[]>(ini.workforce ?? []);
  const [equipment, setEquipment] = useState<EQ[]>(ini.equipment ?? []);
  const [activities, setActivities] = useState<AC[]>(ini.activities ?? []);

  const [submitting, setSubmitting] = useState(false);

  const totalWorkers = workforce.reduce((s, w) => s + (Number(w.count) || 0), 0);

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        fd.set("workforce_json", JSON.stringify(workforce));
        fd.set("equipment_json", JSON.stringify(equipment));
        fd.set("activities_json", JSON.stringify(activities));
        try { await createOrUpdateRdo(fd); }
        finally { setSubmitting(false); }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      <input type="hidden" name="siteId" value={props.siteId} />
      {props.rdoId && <input type="hidden" name="rdoId" value={props.rdoId} />}

      {/* Data + status */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>Dados gerais</h3>
        <div className="rdo-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Data" required>
            <input name="date" type="date" required value={date}
              onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Status">
            <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              <option value="draft">Rascunho</option>
              <option value="submitted">Enviado p/ aprovação</option>
              <option value="review">Em revisão</option>
              <option value="approved">Aprovado</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Clima */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>☀ Clima</h3>
        <div className="rdo-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Tempo manhã">
            <select name="weather_morning" value={wm} onChange={(e) => setWm(e.target.value)} style={inputStyle}>
              {CLIMAS.map(c => <option key={c} value={c}>{c || "—"}</option>)}
            </select>
          </Field>
          <Field label="Condição manhã">
            <select name="condition_morning" value={cm} onChange={(e) => setCm(e.target.value)} style={inputStyle}>
              {CONDICOES.map(c => <option key={c} value={c}>{c || "—"}</option>)}
            </select>
          </Field>
          <Field label="Tempo tarde">
            <select name="weather_afternoon" value={wa} onChange={(e) => setWa(e.target.value)} style={inputStyle}>
              {CLIMAS.map(c => <option key={c} value={c}>{c || "—"}</option>)}
            </select>
          </Field>
          <Field label="Condição tarde">
            <select name="condition_afternoon" value={ca} onChange={(e) => setCa(e.target.value)} style={inputStyle}>
              {CONDICOES.map(c => <option key={c} value={c}>{c || "—"}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Mão de obra */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 className="section-title" style={{ margin: 0 }}>👷 Mão de obra · {totalWorkers} pessoas</h3>
          <button type="button" className="chip" onClick={() => setWorkforce([...workforce, { role: "", count: 1 }])}>
            + Adicionar
          </button>
        </div>
        {workforce.length === 0 && <Empty text="Nenhuma função adicionada" />}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {workforce.map((w, i) => (
            <div key={i} className="row-3col" style={{ display: "grid", gridTemplateColumns: "1fr 100px 36px", gap: 10, alignItems: "center" }}>
              <input list="role-options" placeholder="Função (ex: Pedreiro)" value={w.role}
                onChange={(e) => updateAt(workforce, setWorkforce, i, { ...w, role: e.target.value })}
                style={inputStyle} />
              <input type="number" min={0} value={w.count}
                onChange={(e) => updateAt(workforce, setWorkforce, i, { ...w, count: Number(e.target.value) || 0 })}
                style={inputStyle} className="tnum" />
              <button type="button" onClick={() => setWorkforce(workforce.filter((_, j) => j !== i))}
                style={removeBtn} aria-label="Remover">×</button>
            </div>
          ))}
        </div>
        <datalist id="role-options">{ROLES_DEFAULT.map(r => <option key={r} value={r} />)}</datalist>
      </div>

      {/* Equipamentos */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 className="section-title" style={{ margin: 0 }}>🔧 Equipamentos · {equipment.length}</h3>
          <button type="button" className="chip" onClick={() => setEquipment([...equipment, { name: "", hours: null }])}>
            + Adicionar
          </button>
        </div>
        {equipment.length === 0 && <Empty text="Nenhum equipamento" />}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {equipment.map((e, i) => (
            <div key={i} className="row-3col" style={{ display: "grid", gridTemplateColumns: "1fr 100px 36px", gap: 10, alignItems: "center" }}>
              <input placeholder="Equipamento (ex: Betoneira)" value={e.name}
                onChange={(ev) => updateAt(equipment, setEquipment, i, { ...e, name: ev.target.value })}
                style={inputStyle} />
              <input type="number" min={0} step={0.5} placeholder="Horas" value={e.hours ?? ""}
                onChange={(ev) => updateAt(equipment, setEquipment, i, { ...e, hours: ev.target.value ? Number(ev.target.value) : null })}
                style={inputStyle} className="tnum" />
              <button type="button" onClick={() => setEquipment(equipment.filter((_, j) => j !== i))}
                style={removeBtn} aria-label="Remover">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Atividades */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 className="section-title" style={{ margin: 0 }}>📋 Atividades · {activities.length}</h3>
          <button type="button" className="chip" onClick={() => setActivities([...activities, { description: "", progress_pct: 0, notes: null }])}>
            + Adicionar
          </button>
        </div>
        {activities.length === 0 && <Empty text="Nenhuma atividade" />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activities.map((a, i) => (
            <div key={i} className="row-3col" style={{ display: "grid", gridTemplateColumns: "1fr 90px 36px", gap: 10, alignItems: "center" }}>
              <input placeholder="O que foi feito hoje?" value={a.description}
                onChange={(ev) => updateAt(activities, setActivities, i, { ...a, description: ev.target.value })}
                style={inputStyle} />
              <input type="number" min={0} max={100} placeholder="%" value={a.progress_pct ?? ""}
                onChange={(ev) => updateAt(activities, setActivities, i, { ...a, progress_pct: ev.target.value ? Number(ev.target.value) : null })}
                style={inputStyle} className="tnum" />
              <button type="button" onClick={() => setActivities(activities.filter((_, j) => j !== i))}
                style={removeBtn} aria-label="Remover">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Observações */}
      <div className="card" style={{ padding: "22px 24px" }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>📝 Observações gerais</h3>
        <textarea name="general_notes" rows={5} value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Equipe iniciou contramarcos. Recebimento de material às 10h. Pintura paralisada por chuva à tarde…"
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }} />
        {isEdit && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--o-text-3)" }}>
            Para adicionar/remover fotos, salve as mudanças e use a seção de fotos no detalhe do RDO.
          </p>
        )}
      </div>

      <button type="submit" disabled={submitting} className="btn-brand" style={{
        padding: "14px 24px", fontSize: 15, justifyContent: "center",
        opacity: submitting ? 0.6 : 1, cursor: submitting ? "wait" : "pointer",
      }}>
        {submitting ? (isEdit ? "Salvando…" : "Criando…") : (isEdit ? "Salvar alterações" : "Criar RDO")}
      </button>
    </form>
  );
}

/* ───────── helpers ───────── */

function updateAt<T>(list: T[], set: (l: T[]) => void, i: number, value: T) {
  const next = [...list];
  next[i] = value;
  set(next);
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--o-text-2)", marginBottom: 6, fontWeight: 500 }}>
        {label}{required && <span style={{ color: "var(--o-accent, #C28E3A)", marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{
      padding: "16px", textAlign: "center", color: "var(--o-text-3)",
      fontSize: 13, background: "var(--o-mist)", borderRadius: 8,
    }}>{text}</div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  padding: "11px 14px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text-1)",
  outline: "none",
  transition: "all var(--duration) var(--ease)",
};

const removeBtn: React.CSSProperties = {
  width: 36, height: 36,
  background: "var(--o-mist)",
  border: "1px solid var(--o-border)",
  borderRadius: 8,
  fontSize: 18, color: "var(--o-text-2)",
  cursor: "pointer", lineHeight: 1,
};
