import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase, WEB_APP_URL } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Button, Card, Field } from "@/components/ui";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      Alert.alert("Obralia", "Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (error) {
      Alert.alert("Não foi possível entrar", "Confira o e-mail e a senha. Em caso de dúvida, fale com o administrador.");
      return;
    }
    router.replace("/(app)/obras");
  }

  async function handleForgot() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert("Obralia", "Digite seu e-mail no campo acima e toque em 'Esqueci minha senha' de novo.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${WEB_APP_URL}/auth/callback`,
    });
    Alert.alert(
      "Obralia",
      error
        ? "Não foi possível enviar o e-mail agora. Tente novamente em instantes."
        : "Enviamos um link de redefinição pro seu e-mail."
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: theme.spacing(6) }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.colors.bg }}
      >
        <View style={{ alignItems: "center", marginBottom: theme.spacing(8) }}>
          <Text style={{ fontSize: 34, fontWeight: "700", color: theme.colors.primary }}>Obralia</Text>
          <Text style={{ fontSize: theme.font.body, color: theme.colors.textMuted, marginTop: 4 }}>
            O sistema operacional da obra
          </Text>
        </View>

        <Card>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
          />
          <Button title="Entrar" onPress={handleLogin} loading={loading} />
          <View style={{ height: theme.spacing(3) }} />
          <Button title="Esqueci minha senha" onPress={handleForgot} variant="secondary" />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
