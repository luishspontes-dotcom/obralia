import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { subscribeOutbox } from "@/lib/outbox";
import { theme } from "@/lib/theme";
import { Card, EmptyState } from "@/components/ui";
import type { Site } from "@/lib/types";

export default function ObrasScreen() {
  const [sites, setSites] = useState<Site[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    // RLS decide o que aparece: membro só vê as obras da organização
    // (e, se restrito via member_site_access, só as liberadas pra ele).
    const { data } = await supabase
      .from("sites")
      .select("id, organization_id, name, status, client_name, address, cover_url, responsible_name")
      .neq("status", "arquivada")
      .order("name");
    setSites((data as Site[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
    return subscribeOutbox(setPending);
  }, [load]);

  const filtered = search
    ? sites.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : sites;

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1, padding: theme.spacing(4) }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => void supabase.auth.signOut()}>
              <Text style={{ color: theme.colors.primary, fontSize: theme.font.label }}>Sair</Text>
            </Pressable>
          ),
        }}
      />

      {pending > 0 && (
        <View
          style={{
            backgroundColor: theme.colors.warningSurface,
            borderRadius: theme.radius.sm,
            padding: theme.spacing(3),
            marginBottom: theme.spacing(3),
          }}
        >
          <Text style={{ color: theme.colors.warning, fontSize: theme.font.label, fontWeight: "600" }}>
            {pending} envio(s) aguardando sinal — serão sincronizados automaticamente.
          </Text>
        </View>
      )}

      <TextInput
        placeholder="Buscar obra..."
        placeholderTextColor={theme.colors.textMuted}
        value={search}
        onChangeText={setSearch}
        style={{
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.sm,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: theme.spacing(3),
          fontSize: theme.font.body,
          color: theme.colors.text,
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma obra por aqui"
            subtitle="Puxe pra baixo pra atualizar. Se a obra não aparecer, peça acesso ao administrador."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/(app)/obra/[id]", params: { id: item.id, name: item.name } })}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], marginBottom: theme.spacing(3) })}
          >
            <Card>
              <Text style={{ fontSize: theme.font.subtitle, fontWeight: "600", color: theme.colors.text }}>
                {item.name}
              </Text>
              {item.client_name ? (
                <Text style={{ fontSize: theme.font.label, color: theme.colors.textMuted, marginTop: 2 }}>
                  {item.client_name}
                </Text>
              ) : null}
              {item.address ? (
                <Text style={{ fontSize: theme.font.caption, color: theme.colors.textMuted, marginTop: 4 }}>
                  {item.address}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
