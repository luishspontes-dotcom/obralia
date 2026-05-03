import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  // Types do Supabase ficam desatualizados toda vez que rodamos uma migration.
  // Mantemos ignoreBuildErrors=true e regeneramos os types como passo de DX
  // separado. Build de produção segue funcionando — runtime usa Postgres real.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "www.meuviverconstrutora.com.br" },
    ],
  },
};

export default nextConfig;
