import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { theme } from "@/lib/theme";

/* Primitivas de UI do app — feedback tátil (spring press) em tudo que é tocável. */

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    variant === "primary" ? theme.colors.primary : variant === "danger" ? theme.colors.danger : theme.colors.card;
  const fg = variant === "secondary" ? theme.colors.primary : "#FFFFFF";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: theme.colors.primary,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.972 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: theme.font.body, fontWeight: "600" }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ marginBottom: theme.spacing(3) }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        {...rest}
        style={[styles.input, rest.multiline ? { height: 96, textAlignVertical: "top" } : null, rest.style]}
      />
    </View>
  );
}

/** Seletor de opção única (clima, condição). Estado ativo usa a cor primária plena. */
export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: theme.spacing(3) }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(active ? "" : option)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.card,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  color: active ? "#FFFFFF" : theme.colors.text,
                  fontSize: theme.font.label,
                  fontWeight: active ? "600" : "400",
                }}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ alignItems: "center", padding: theme.spacing(10) }}>
      <Text style={{ fontSize: theme.font.subtitle, fontWeight: "600", color: theme.colors.text }}>{title}</Text>
      <Text
        style={{
          fontSize: theme.font.body,
          color: theme.colors.textMuted,
          textAlign: "center",
          marginTop: theme.spacing(2),
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(4),
  },
  label: {
    fontSize: theme.font.label,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: theme.font.body,
    color: theme.colors.text,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
