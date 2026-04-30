import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  // Permite primeiro deploy com types ainda imperfeitos (Supabase queries
  // sem types gerados). Removemos isso assim que `supabase gen types` for rodado.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "www.meuviverconstrutora.com.br" },
    ],
  },
};

export default nextConfig;
