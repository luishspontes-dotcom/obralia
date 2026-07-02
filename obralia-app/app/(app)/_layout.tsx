import React from "react";
import { Redirect, Stack } from "expo-router";
import { useSession } from "@/app/_layout";
import { theme } from "@/lib/theme";

export default function AppLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="obras" options={{ title: "Obras" }} />
      <Stack.Screen name="obra/[id]/index" options={{ title: "Obra" }} />
      <Stack.Screen name="obra/[id]/rdo" options={{ title: "RDO de hoje" }} />
      <Stack.Screen name="obra/[id]/fotos" options={{ title: "Fotos" }} />
    </Stack>
  );
}
