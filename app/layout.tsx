import type { Metadata, Viewport } from "next";
import { Inter, Lora, JetBrains_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.obralia.com.br";

export const metadata: Metadata = {
  title: "Obralia — sistema operacional da obra",
  description:
    "SaaS multi-tenant para construtoras de alto padrão. RDO, EAP, fotos, cronograma e inbox em um só lugar.",
  metadataBase: new URL(appUrl),
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Obralia",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Obralia",
    title: "Obralia — sistema operacional da obra",
    description:
      "RDO, EAP, fotos, cronograma e inbox em um só lugar. Pra construtoras que querem operar com a mesma precisão de uma planta.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Obralia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Obralia — sistema operacional da obra",
    description:
      "RDO, EAP, fotos, cronograma e inbox em um só lugar. Pra construtoras que querem operar com a mesma precisão de uma planta.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  themeColor: "#08789B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${lora.variable} ${jbMono.variable}`}
    >
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
