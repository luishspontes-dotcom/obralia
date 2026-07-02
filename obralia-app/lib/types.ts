export type Site = {
  id: string;
  organization_id: string;
  name: string;
  status: string | null;
  client_name: string | null;
  address: string | null;
  cover_url: string | null;
  responsible_name: string | null;
};

export type DailyReport = {
  id: string;
  site_id: string;
  number: number | null;
  date: string;
  status: string | null;
  weather_morning: string | null;
  weather_afternoon: string | null;
  condition_morning: string | null;
  condition_afternoon: string | null;
  general_notes: string | null;
};

export type MediaItem = {
  id: string;
  site_id: string;
  kind: string;
  storage_path: string;
  caption: string | null;
  taken_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
};

export type ActivityDraft = { description: string; progress_pct: string };
export type WorkforceDraft = { role: string; count: string };
export type EquipmentDraft = { name: string; hours: string };

export type RdoDraft = {
  siteId: string;
  siteName: string;
  reportDate: string; // YYYY-MM-DD
  weatherMorning: string;
  weatherAfternoon: string;
  conditionMorning: string;
  conditionAfternoon: string;
  generalNotes: string;
  activities: ActivityDraft[];
  workforce: WorkforceDraft[];
  equipment: EquipmentDraft[];
};

export type PhotoDraft = {
  siteId: string;
  /** Arquivo local (file://...) aguardando upload. */
  localUri: string;
  takenAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  caption: string | null;
};

export const WEATHER_OPTIONS = ["Ensolarado", "Nublado", "Chuvoso", "Garoa"] as const;
export const CONDITION_OPTIONS = ["Praticável", "Impraticável"] as const;
