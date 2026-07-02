import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { enqueue, processOutbox, pendingCount } from "@/lib/outbox";
import { theme } from "@/lib/theme";
import { Button, Card, ChipGroup, Field } from "@/components/ui";
import {
  CONDITION_OPTIONS,
  WEATHER_OPTIONS,
  type ActivityDraft,
  type EquipmentDraft,
  type WorkforceDraft,
} from "@/lib/types";

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function RdoScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [weatherMorning, setWeatherMorning] = useState("");
  const [weatherAfternoon, setWeatherAfternoon] = useState("");
  const [conditionMorning, setConditionMorning] = useState("");
  const [conditionAfternoon, setConditionAfternoon] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [activities, setActivities] = useState<ActivityDraft[]>([{ description: "", progress_pct: "" }]);
  const [workforce, setWorkforce] = useState<WorkforceDraft[]>([{ role: "", count: "" }]);
  const [equipment, setEquipment] = useState<EquipmentDraft[]>([{ name: "", hours: "" }]);
  const [saving, setSaving] = useState(false);

  function patch<T>(list: T[], index: number, changes: Partial<T>): T[] {
    return list.map((item, i) => (i === index ? { ...item, ...changes } : item));
  }

  async function handleSave() {
    if (!id) return;
    if (!weatherMorning && !weatherAfternoon && !generalNotes && !activities[0]?.description) {
      Alert.alert("Obralia", "Preencha ao menos o clima ou uma atividade antes de salvar.");
      return;
    }
    setSaving(true);
    await enqueue({
      type: "rdo",
      payload: {
        siteId: id,
        siteName: name ?? "",
        reportDate: todayISO(),
        weatherMorning,
        weatherAfternoon,
        conditionMorning,
        conditionAfternoon,
        generalNotes,
        activities,
        workforce,
        equipment,
      },
    });
    await processOutbox();
    const remaining = await pendingCount();
    setSaving(false);

    const net = await NetInfo.fetch();
    if (remaining > 0 || !net.isConnected) {
      Alert.alert(
        "RDO guardado no aparelho",
        "Sem sinal agora. O RDO será enviado automaticamente assim que a conexão voltar.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } else {
      Alert.alert("Obralia", "RDO enviado com sucesso.", [{ text: "OK", onPress: () => router.back() }]);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(4) }} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: name ? `RDO — ${name}` : "RDO de hoje" }} />

        <Card style={{ marginBottom: theme.spacing(3) }}>
          <ChipGroup label="Clima — manhã" options={WEATHER_OPTIONS} value={weatherMorning} onChange={setWeatherMorning} />
          <ChipGroup label="Clima — tarde" options={WEATHER_OPTIONS} value={weatherAfternoon} onChange={setWeatherAfternoon} />
          <ChipGroup label="Condição — manhã" options={CONDITION_OPTIONS} value={conditionMorning} onChange={setConditionMorning} />
          <ChipGroup label="Condição — tarde" options={CONDITION_OPTIONS} value={conditionAfternoon} onChange={setConditionAfternoon} />
        </Card>

        <Card style={{ marginBottom: theme.spacing(3) }}>
          <SectionTitle title="Atividades do dia" />
          {activities.map((activity, index) => (
            <View key={index} style={{ marginBottom: theme.spacing(2) }}>
              <Field
                label={`Atividade ${index + 1}`}
                value={activity.description}
                onChangeText={(v) => setActivities((list) => patch(list, index, { description: v }))}
                placeholder="Ex.: Concretagem da laje do 2º pavimento"
              />
              <Field
                label="Avanço (%)"
                value={activity.progress_pct}
                onChangeText={(v) => setActivities((list) => patch(list, index, { progress_pct: v }))}
                keyboardType="numeric"
                placeholder="Ex.: 60"
              />
            </View>
          ))}
          <AddRow onPress={() => setActivities((l) => [...l, { description: "", progress_pct: "" }])} />
        </Card>

        <Card style={{ marginBottom: theme.spacing(3) }}>
          <SectionTitle title="Efetivo (mão de obra)" />
          {workforce.map((row, index) => (
            <View key={index} style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 2 }}>
                <Field
                  label="Função"
                  value={row.role}
                  onChangeText={(v) => setWorkforce((list) => patch(list, index, { role: v }))}
                  placeholder="Ex.: Pedreiro"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Qtde"
                  value={row.count}
                  onChangeText={(v) => setWorkforce((list) => patch(list, index, { count: v }))}
                  keyboardType="numeric"
                  placeholder="2"
                />
              </View>
            </View>
          ))}
          <AddRow onPress={() => setWorkforce((l) => [...l, { role: "", count: "" }])} />
        </Card>

        <Card style={{ marginBottom: theme.spacing(3) }}>
          <SectionTitle title="Equipamentos" />
          {equipment.map((row, index) => (
            <View key={index} style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 2 }}>
                <Field
                  label="Equipamento"
                  value={row.name}
                  onChangeText={(v) => setEquipment((list) => patch(list, index, { name: v }))}
                  placeholder="Ex.: Betoneira"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Horas"
                  value={row.hours}
                  onChangeText={(v) => setEquipment((list) => patch(list, index, { hours: v }))}
                  keyboardType="numeric"
                  placeholder="8"
                />
              </View>
            </View>
          ))}
          <AddRow onPress={() => setEquipment((l) => [...l, { name: "", hours: "" }])} />
        </Card>

        <Card style={{ marginBottom: theme.spacing(4) }}>
          <Field
            label="Observações gerais"
            value={generalNotes}
            onChangeText={setGeneralNotes}
            multiline
            placeholder="Ocorrências, visitas, entregas de material..."
          />
        </Card>

        <Button title="Salvar RDO" onPress={handleSave} loading={saving} />
        <Text
          style={{
            textAlign: "center",
            color: theme.colors.textMuted,
            fontSize: theme.font.caption,
            marginTop: theme.spacing(3),
            marginBottom: theme.spacing(8),
          }}
        >
          Sem sinal no canteiro? Salve normalmente — o envio acontece sozinho quando a conexão voltar.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: theme.font.subtitle,
        fontWeight: "600",
        color: theme.colors.text,
        marginBottom: theme.spacing(3),
      }}
    >
      {title}
    </Text>
  );
}

function AddRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Text style={{ color: theme.colors.primary, fontWeight: "600", fontSize: theme.font.body }}>+ Adicionar linha</Text>
    </Pressable>
  );
}
