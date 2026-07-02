/**
 * Tokens do design system Obralia (espelham os do web).
 * Nada de cor hardcoded nas telas — sempre via theme.
 */
export const theme = {
  colors: {
    primary: "#006FFF",
    primaryDark: "#0052BD",
    primarySurface: "rgba(0, 111, 255, 0.08)",
    bg: "#F5F7FA",
    card: "#FFFFFF",
    text: "#0F1728",
    textMuted: "#5B6779",
    border: "#E4E9F0",
    success: "#12873D",
    successSurface: "rgba(18, 135, 61, 0.10)",
    warning: "#B45309",
    warningSurface: "rgba(180, 83, 9, 0.10)",
    danger: "#C02626",
    dangerSurface: "rgba(192, 38, 38, 0.08)",
  },
  radius: { sm: 10, md: 14, lg: 20 },
  spacing: (n: number) => n * 4,
  font: {
    title: 22,
    subtitle: 17,
    body: 15,
    label: 13,
    caption: 12,
  },
} as const;
