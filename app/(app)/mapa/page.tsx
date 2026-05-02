import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { MapView } from "@/components/MapView";

type SitePin = {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  photoLat: number | null;
  photoLng: number | null;
};

export default async function MapaPage() {
  const supabase = await createServerSupabase();
  const { data: sitesRaw } = await supabase
    .from("sites").select("id, name, client_name, status, lat, lng");
  const sites = (sitesRaw ?? []) as Array<Omit<SitePin, "photoLat" | "photoLng">>;

  // Pra obras sem lat/lng cadastrados, tenta inferir da foto mais recente com GPS
  const { data: gpsRaw } = await supabase
    .from("media")
    .select("site_id, gps_lat, gps_lng")
    .not("gps_lat", "is", null)
    .not("gps_lng", "is", null);
  const gpsMap = new Map<string, { lat: number; lng: number }>();
  for (const r of (gpsRaw ?? []) as Array<{ site_id: string; gps_lat: number; gps_lng: number }>) {
    if (!gpsMap.has(r.site_id)) gpsMap.set(r.site_id, { lat: r.gps_lat, lng: r.gps_lng });
  }

  const pins: SitePin[] = sites.map((s) => ({
    ...s,
    photoLat: gpsMap.get(s.id)?.lat ?? null,
    photoLng: gpsMap.get(s.id)?.lng ?? null,
  })).filter((s) => s.lat !== null || s.photoLat !== null);

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
          </div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Mapa
          </div>
          <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Mapa das obras
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {pins.length} obras com localização · pins inferidos por foto com GPS quando o endereço não tem coordenadas.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {pins.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">🗺️</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Sem obras geolocalizadas ainda
            </div>
            <div style={{ fontSize: 13 }}>
              Cadastre lat/lng na obra ou faça upload de fotos com GPS no celular pra os pins aparecerem.
            </div>
          </div>
        ) : (
          <MapView pins={pins} />
        )}
      </div>
    </div>
  );
}
