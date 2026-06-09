"use client";

import { useEffect, useRef, useState } from "react";

/* ── Resultado estruturado devolvido por /api/rdo-voice ── */
type WfItem = { role: string; count: number };
type EqItem = { name: string; hours: number | null };
type AcItem = { description: string; progress_pct: number | null };
type MtItem = { name: string; quantity: number | null; unit: string | null };

type RdoVoiceData = {
  weather_morning: string | null;
  weather_afternoon: string | null;
  condition_morning: string | null;
  condition_afternoon: string | null;
  work_start: string | null;
  work_end: string | null;
  workforce: WfItem[];
  equipment: EqItem[];
  activities: AcItem[];
  materials: MtItem[];
  general_notes: string | null;
};

/* ── Draft do RdoForm — MESMA chave e MESMO shape de components/RdoForm.tsx ── */
type RdoDraft = {
  date: string;
  status: string;
  weather_morning: string;
  weather_afternoon: string;
  condition_morning: string;
  condition_afternoon: string;
  general_notes: string;
  work_start: string;
  work_end: string;
  work_break_minutes: number;
  workforce: WfItem[];
  equipment: EqItem[];
  activities: { description: string; progress_pct: number | null; notes: string | null }[];
  materials: { name: string; quantity: number | null; unit: string | null; notes: string | null }[];
};

function draftKey(siteId: string): string {
  return `obralia:rdo-draft:${siteId}:new`;
}

/* ── Tipagem mínima da Web Speech API (não vem no lib.dom padrão) ── */
type SpeechAlternativeLike = { transcript: string };
type SpeechResultLike = { isFinal: boolean; 0: SpeechAlternativeLike };
type SpeechResultListLike = { length: number; [index: number]: SpeechResultLike };
type SpeechRecognitionEventLike = { resultIndex: number; results: SpeechResultListLike };
type SpeechRecognitionErrorLike = { error: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function RdoVoiceAssist({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [result, setResult] = useState<RdoVoiceData | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const stoppedByUser = useRef(false);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  useEffect(() => {
    return () => {
      // desmonta no meio da gravação → para o reconhecimento
      stoppedByUser.current = true;
      try { recRef.current?.stop(); } catch { /* já parado */ }
    };
  }, []);

  const startRecording = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) finalChunk += text;
        else interimChunk += text;
      }
      if (finalChunk.trim()) {
        setTranscript((prev) => (prev ? prev.trimEnd() + " " : "") + finalChunk.trim());
      }
      setInterim(interimChunk.trim());
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Permissão de microfone negada. Libere o microfone nas configurações do navegador e tente de novo.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError("Falha no reconhecimento de voz (" + event.error + "). Tente novamente.");
      }
    };
    rec.onend = () => {
      setRecording(false);
      setInterim("");
      recRef.current = null;
    };
    recRef.current = rec;
    stoppedByUser.current = false;
    try {
      rec.start();
      setRecording(true);
    } catch {
      setError("Não foi possível iniciar a gravação. Tente novamente.");
    }
  };

  const stopRecording = () => {
    stoppedByUser.current = true;
    try { recRef.current?.stop(); } catch { /* já parado */ }
    setRecording(false);
  };

  const structure = async () => {
    if (!transcript.trim() || loading) return;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    setResult(null);
    try {
      const res = await fetch("/api/rdo-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript.trim() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { data?: RdoVoiceData; error?: string }
        | null;
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok || !body?.data) {
        setError(body?.error ?? `Não foi possível estruturar o relato (erro ${res.status}). Tente de novo.`);
        return;
      }
      setResult(body.data);
    } catch {
      setError("Falha de conexão ao estruturar o relato. Verifique a internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const applyToForm = () => {
    if (!result || typeof window === "undefined") return;
    const key = draftKey(siteId);
    let existing: Partial<RdoDraft> = {};
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) existing = JSON.parse(raw) as RdoDraft;
    } catch {
      existing = {};
    }
    const draft: RdoDraft = {
      date: existing.date ?? new Date().toISOString().slice(0, 10),
      status: existing.status ?? "draft",
      weather_morning: result.weather_morning ?? existing.weather_morning ?? "",
      weather_afternoon: result.weather_afternoon ?? existing.weather_afternoon ?? "",
      condition_morning: result.condition_morning ?? existing.condition_morning ?? "",
      condition_afternoon: result.condition_afternoon ?? existing.condition_afternoon ?? "",
      general_notes: result.general_notes ?? existing.general_notes ?? "",
      work_start: result.work_start ?? existing.work_start ?? "",
      work_end: result.work_end ?? existing.work_end ?? "",
      work_break_minutes: existing.work_break_minutes ?? 60,
      workforce: result.workforce.length > 0 ? result.workforce : existing.workforce ?? [],
      equipment: result.equipment.length > 0 ? result.equipment : existing.equipment ?? [],
      activities: result.activities.length > 0
        ? result.activities.map((a) => ({ description: a.description, progress_pct: a.progress_pct, notes: null }))
        : existing.activities ?? [],
      materials: result.materials.length > 0
        ? result.materials.map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit, notes: null }))
        : existing.materials ?? [],
    };
    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      setError("Não foi possível salvar o rascunho local (memória do navegador cheia ou modo privado).");
      return;
    }
    window.location.reload(); // o RdoForm restaura o draft sozinho ao recarregar
  };

  const sectionsFound = result
    ? [
        result.weather_morning || result.weather_afternoon || result.condition_morning || result.condition_afternoon ? 1 : 0,
        result.work_start || result.work_end ? 1 : 0,
        result.workforce.length > 0 ? 1 : 0,
        result.equipment.length > 0 ? 1 : 0,
        result.activities.length > 0 ? 1 : 0,
        result.materials.length > 0 ? 1 : 0,
        result.general_notes ? 1 : 0,
      ].reduce((s, n) => s + n, 0)
    : 0;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
      <style>{`@keyframes o-rec-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.8); } }`}</style>

      {/* Header colapsável */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, padding: "16px 20px", background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🎙️</span>
          <span style={{ font: "600 14px var(--font-inter)", color: "var(--o-text-1)" }}>
            Ditar RDO por voz
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--t-brand)", background: "var(--o-mist)", border: "1px solid var(--o-border)",
            borderRadius: 999, padding: "2px 8px",
          }}>
            beta
          </span>
        </span>
        <span aria-hidden style={{ color: "var(--o-text-3)", fontSize: 13 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--o-text-2)", lineHeight: 1.5 }}>
            Fale o que aconteceu na obra hoje — clima, horários, equipe, equipamentos, atividades e
            materiais. A IA organiza tudo nos campos do formulário.
          </p>

          {supported === false && (
            <div style={infoBox}>
              😕 Seu navegador não suporta reconhecimento de voz (ex: Firefox). Use o Chrome, Edge ou
              Safari — ou digite o relato direto na caixa abaixo e clique em “Estruturar com IA”.
            </div>
          )}

          {/* Controles de gravação */}
          {supported !== false && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {!recording ? (
                <button type="button" className="chip" onClick={startRecording} disabled={supported === null}>
                  🎙️ Iniciar gravação
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                    border: "1px solid #d4574e", background: "#fdf1f0",
                    color: "#a83a32", font: "600 13px var(--font-inter)",
                  }}
                >
                  <span aria-hidden style={{
                    width: 10, height: 10, borderRadius: "50%", background: "#d4574e",
                    animation: "o-rec-pulse 1.1s ease-in-out infinite",
                  }} />
                  Gravando… toque para parar
                </button>
              )}
              {recording && interim && (
                <span style={{ fontSize: 13, color: "var(--o-text-3)", fontStyle: "italic" }}>
                  {interim}…
                </span>
              )}
            </div>
          )}

          {/* Transcrição editável */}
          <div>
            <label htmlFor="rdo-voice-transcript" style={{
              display: "block", fontSize: 12, color: "var(--o-text-2)", marginBottom: 6, fontWeight: 500,
            }}>
              Transcrição (revise e corrija antes de estruturar)
            </label>
            <textarea
              id="rdo-voice-transcript"
              rows={5}
              value={transcript}
              readOnly={recording}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Ex: Hoje a manhã foi clara e praticável, à tarde caiu uma garoa. Trabalhamos das 7 às 17 com uma hora de almoço. Tivemos 4 pedreiros, 2 serventes e 1 eletricista. A betoneira rodou 6 horas. Concretamos a laje do segundo pavimento, uns 80 por cento…"
              style={{
                width: "100%", background: "var(--o-paper)", border: "1px solid var(--o-border)",
                borderRadius: 10, padding: "11px 14px", font: "400 14px var(--font-inter)",
                color: "var(--o-text-1)", outline: "none", resize: "vertical", lineHeight: 1.6,
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-brand"
              onClick={structure}
              disabled={!transcript.trim() || loading || recording}
              style={{
                padding: "10px 18px", fontSize: 14,
                opacity: !transcript.trim() || loading || recording ? 0.55 : 1,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Estruturando…" : "✨ Estruturar com IA"}
            </button>
            {transcript && !recording && (
              <button type="button" className="chip" onClick={() => { setTranscript(""); setResult(null); }}>
                Limpar
              </button>
            )}
          </div>

          {error && (
            <div role="alert" style={{ ...infoBox, borderColor: "#e3b9b5", background: "#fdf4f3" }}>
              ⚠️ {error}
            </div>
          )}

          {notConfigured && (
            <div style={infoBox}>
              🔧 A IA não está configurada neste ambiente. Sem problema: copie o texto da transcrição
              acima e preencha o formulário abaixo manualmente — as observações gerais são um bom
              lugar para colar o relato completo.
            </div>
          )}

          {/* Preview do resultado */}
          {result && (
            <div style={{
              border: "1px solid var(--o-border)", borderRadius: 12,
              background: "var(--o-mist)", padding: "16px 18px",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--o-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                ✨ {sectionsFound} {sectionsFound === 1 ? "seção reconhecida" : "seções reconhecidas"}
              </div>

              {(result.weather_morning || result.condition_morning || result.weather_afternoon || result.condition_afternoon) && (
                <PreviewRow label="☀ Clima">
                  {[
                    result.weather_morning && `manhã: ${result.weather_morning}`,
                    result.condition_morning && `(${result.condition_morning})`,
                    result.weather_afternoon && `· tarde: ${result.weather_afternoon}`,
                    result.condition_afternoon && `(${result.condition_afternoon})`,
                  ].filter(Boolean).join(" ")}
                </PreviewRow>
              )}

              {(result.work_start || result.work_end) && (
                <PreviewRow label="🕐 Jornada">
                  {[result.work_start ?? "—", result.work_end ?? "—"].join(" às ")}
                </PreviewRow>
              )}

              {result.workforce.length > 0 && (
                <PreviewRow label={`👷 Mão de obra (${result.workforce.length})`}>
                  {result.workforce.map((w) => `${w.count}× ${w.role}`).join(", ")}
                </PreviewRow>
              )}

              {result.equipment.length > 0 && (
                <PreviewRow label={`🔧 Equipamentos (${result.equipment.length})`}>
                  {result.equipment.map((e) => e.hours != null ? `${e.name} (${e.hours}h)` : e.name).join(", ")}
                </PreviewRow>
              )}

              {result.activities.length > 0 && (
                <PreviewRow label={`📋 Atividades (${result.activities.length})`}>
                  {result.activities.map((a) => a.progress_pct != null ? `${a.description} — ${a.progress_pct}%` : a.description).join(" · ")}
                </PreviewRow>
              )}

              {result.materials.length > 0 && (
                <PreviewRow label={`🧱 Materiais (${result.materials.length})`}>
                  {result.materials.map((m) => [m.quantity, m.unit, m.name].filter((x) => x != null && x !== "").join(" ")).join(", ")}
                </PreviewRow>
              )}

              {result.general_notes && (
                <PreviewRow label="📝 Observações">{result.general_notes}</PreviewRow>
              )}

              {sectionsFound === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--o-text-2)" }}>
                  Nenhum dado reconhecido no relato. Tente detalhar mais (clima, horários, equipe, atividades).
                </p>
              )}

              {sectionsFound > 0 && (
                <div>
                  <button
                    type="button"
                    className="btn-brand"
                    onClick={applyToForm}
                    style={{ padding: "10px 18px", fontSize: 14, cursor: "pointer" }}
                  >
                    ✅ Aplicar ao formulário
                  </button>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--o-text-3)" }}>
                    A página recarrega e o formulário abaixo já vem preenchido. Você revisa e ajusta antes de criar o RDO.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
      <span style={{ fontWeight: 600, color: "var(--o-text-1)" }}>{label}: </span>
      <span style={{ color: "var(--o-text-2)" }}>{children}</span>
    </div>
  );
}

const infoBox: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  fontSize: 13,
  lineHeight: 1.5,
  background: "var(--o-mist)",
  border: "1px solid var(--o-border)",
  color: "var(--o-text-1)",
};
