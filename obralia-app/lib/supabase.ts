import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const SUPABASE_URL = extra.supabaseUrl;
export const WEB_APP_URL = extra.webAppUrl ?? "https://www.obralia.com.br";

/**
 * Chave PUBLICÁVEL (sb_publishable_...) — segura para apps distribuídos.
 * Todo acesso a dados passa pela RLS do Postgres: o app só enxerga o que
 * o usuário logado pode ver (mesmas policies do Obralia web).
 */
export const supabase = createClient(SUPABASE_URL, extra.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** URL pública de uma mídia no bucket `media` (bucket público, igual ao web). */
export function mediaPublicUrl(storagePath: string): string {
  return supabase.storage.from("media").getPublicUrl(storagePath).data.publicUrl;
}
