import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Text, View, useWindowDimensions } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import NetInfo from "@react-native-community/netinfo";
import { Image } from "expo-image";
import { mediaPublicUrl, supabase } from "@/lib/supabase";
import { enqueue, processOutbox, subscribeOutbox } from "@/lib/outbox";
import { theme } from "@/lib/theme";
import { Button, EmptyState } from "@/components/ui";
import type { MediaItem } from "@/lib/types";

export default function FotosScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [pending, setPending] = useState(0);
  const { width } = useWindowDimensions();
  const cell = (width - theme.spacing(4) * 2 - 8 * 2) / 3;

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("media")
      .select("id, site_id, kind, storage_path, caption, taken_at, gps_lat, gps_lng")
      .eq("site_id", id)
      .eq("kind", "photo")
      .order("taken_at", { ascending: false })
      .limit(60);
    setPhotos((data as MediaItem[] | null) ?? []);
  }, [id]);

  useEffect(() => {
    void load();
    const unsub = subscribeOutbox((count) => {
      setPending(count);
      if (count === 0) void load(); // fila esvaziou → fotos novas já estão no servidor
    });
    return unsub;
  }, [load]);

  async function capture(fromCamera: boolean) {
    if (!id) return;

    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Obralia", "Permissão negada. Libere o acesso em Ajustes > Obralia.");
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: !fromCamera,
      selectionLimit: 10,
      exif: false,
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || result.assets.length === 0) return;

    // GPS no momento do registro — prova de presença no canteiro.
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;
    try {
      const loc = await Location.getForegroundPermissionsAsync();
      const granted = loc.granted || (await Location.requestForegroundPermissionsAsync()).granted;
      if (granted) {
        const position = await Location.getLastKnownPositionAsync();
        if (position) {
          gpsLat = position.coords.latitude;
          gpsLng = position.coords.longitude;
        }
      }
    } catch {
      // sem GPS não é bloqueante
    }

    for (const asset of result.assets) {
      await enqueue({
        type: "photo",
        payload: {
          siteId: id,
          localUri: asset.uri,
          takenAt: new Date().toISOString(),
          gpsLat,
          gpsLng,
          caption: null,
        },
      });
    }
    await processOutbox();

    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert("Fotos guardadas", "Sem sinal agora — elas sobem sozinhas quando a conexão voltar.");
    }
  }

  return (
    <View style={{ flex: 1, padding: theme.spacing(4) }}>
      <Stack.Screen options={{ title: name ? `Fotos — ${name}` : "Fotos" }} />

      <View style={{ flexDirection: "row", gap: 10, marginBottom: theme.spacing(3) }}>
        <View style={{ flex: 1 }}>
          <Button title="📷 Câmera" onPress={() => void capture(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="🖼 Galeria" onPress={() => void capture(false)} variant="secondary" />
        </View>
      </View>

      {pending > 0 && (
        <Text
          style={{
            color: theme.colors.warning,
            fontSize: theme.font.label,
            fontWeight: "600",
            marginBottom: theme.spacing(2),
          }}
        >
          {pending} envio(s) na fila…
        </Text>
      )}

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma foto ainda"
            subtitle="Registre a primeira foto do dia — ela entra direto no diário da obra."
          />
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: mediaPublicUrl(item.storage_path) }}
            style={{ width: cell, height: cell, borderRadius: theme.radius.sm, backgroundColor: theme.colors.border }}
            contentFit="cover"
            transition={150}
          />
        )}
      />
    </View>
  );
}
