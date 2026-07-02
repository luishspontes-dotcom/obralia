import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Button, Card } from "@/components/ui";
import type { DailyReport } from "@/lib/types";

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ObraScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [photoCount, setPhotoCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: report }, { count }] = await Promise.all([
      supabase
        .from("daily_reports")
        .select("id, site_id, number, date, status, weather_morning, weather_afternoon, condition_morning, condition_afternoon, general_notes")
        .eq("site_id", id)
        .eq("date", todayISO())
        .maybeSingle(),
      supabase.from("media").select("id", { count: "exact", head: true }).eq("site_id", id).eq("kind", "photo"),
    ]);
    setTodayReport((report as DailyReport | null) ?? null);
    setPhotoCount(count ?? 0);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing(4) }}>
      <Stack.Screen options={{ title: name ?? "Obra" }} />

      <Card style={{ marginBottom: theme.spacing(3) }}>
        <Text style={{ fontSize: theme.font.label, color: theme.colors.textMuted, fontWeight: "600" }}>
          RDO DE HOJE
        </Text>
        {todayReport ? (
          <>
            <Text style={{ fontSize: theme.font.subtitle, fontWeight: "600", color: theme.colors.success, marginTop: 6 }}>
              ✓ Registrado{todayReport.number ? ` — nº ${todayReport.number}` : ""}
            </Text>
            <Text style={{ fontSize: theme.font.label, color: theme.colors.textMuted, marginTop: 4 }}>
              {[todayReport.weather_morning, todayReport.weather_afternoon].filter(Boolean).join(" / ") ||
                "Sem clima informado"}
            </Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: theme.font.subtitle, fontWeight: "600", color: theme.colors.warning, marginTop: 6 }}>
              Ainda não preenchido
            </Text>
            <View style={{ marginTop: theme.spacing(3) }}>
              <Button
                title="Preencher RDO de hoje"
                onPress={() => router.push({ pathname: "/(app)/obra/[id]/rdo", params: { id, name: name ?? "" } })}
              />
            </View>
          </>
        )}
      </Card>

      <Card>
        <Text style={{ fontSize: theme.font.label, color: theme.colors.textMuted, fontWeight: "600" }}>FOTOS</Text>
        <Text style={{ fontSize: theme.font.subtitle, fontWeight: "600", color: theme.colors.text, marginTop: 6 }}>
          {photoCount === null ? "—" : `${photoCount} foto(s) registradas`}
        </Text>
        <View style={{ marginTop: theme.spacing(3) }}>
          <Button
            title="Tirar / enviar fotos"
            variant="secondary"
            onPress={() => router.push({ pathname: "/(app)/obra/[id]/fotos", params: { id, name: name ?? "" } })}
          />
        </View>
      </Card>
    </ScrollView>
  );
}
