"use client";

import { Trash2 } from "lucide-react";
import { deleteAiEstimate } from "@/lib/budget-ai/actions";

export function DeleteEstimateButton({
  estimateId,
  redirectTo,
  label = "Apagar",
  compact = false,
}: {
  estimateId: string;
  redirectTo?: string;
  label?: string;
  compact?: boolean;
}) {
  return (
    <form
      action={deleteAiEstimate}
      onSubmit={(event) => {
        if (!window.confirm("Apagar este orçamento IA e seus arquivos? Esta ação não pode ser desfeita.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="estimate_id" value={estimateId} />
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
      <button
        aria-label="Apagar orçamento"
        className={compact ? "do-icon-action" : "chip"}
        type="submit"
        title="Apagar orçamento"
        style={{
          color: "var(--st-late)",
          borderColor: "rgba(180,61,61,.24)",
          cursor: "pointer",
          justifyContent: "center",
        }}
      >
        <Trash2 size={14} />
        {compact ? null : label}
      </button>
    </form>
  );
}
