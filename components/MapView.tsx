"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";

type Pin = {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  photoLat: number | null;
  photoLng: number | null;
};

export function MapView({ pins }: { pins: Pin[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: Leaflet.Map | null = null;
    let cancelled = false;

    async function init() {
      if (!ref.current) return;
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      const points = pins.map((p) => ({
        ...p,
        finalLat: p.lat ?? p.photoLat!,
        finalLng: p.lng ?? p.photoLng!,
      })).filter((p) => Number.isFinite(p.finalLat) && Number.isFinite(p.finalLng));

      if (points.length === 0) return;

      // centroid
      const cx = points.reduce((s, p) => s + p.finalLat, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.finalLng, 0) / points.length;

      map = L.map(ref.current).setView([cx, cy], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const STATUS_COLOR: Record<string, string> = {
        in_progress: "#08789B",
        done: "#137a4d",
        late: "#d83a3a",
        paused: "#888",
      };

      for (const p of points) {
        const color = STATUS_COLOR[p.status] ?? "#08789B";
        const icon = L.divIcon({
          className: "obralia-pin",
          html: `<div style="background:${color};width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 18],
        });
        L.marker([p.finalLat, p.finalLng], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${p.name}</strong>${p.client_name ? `<br/><small>${p.client_name}</small>` : ""}<br/><a href="/obras/${p.id}">Abrir →</a>`
          );
      }
    }

    init();
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [pins]);

  return (
    <div ref={ref} style={{
      width: "100%",
      height: 600,
      borderRadius: 12,
      overflow: "hidden",
      border: "1px solid var(--o-border)",
    }} />
  );
}
