export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          id: string
          mentions: string[] | null
          organization_id: string
          target_id: string
          target_table: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          mentions?: string[] | null
          organization_id: string
          target_id: string
          target_table: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          mentions?: string[] | null
          organization_id?: string
          target_id?: string
          target_table?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          condition_afternoon: string | null
          condition_morning: string | null
          created_at: string | null
          created_by: string | null
          date: string
          general_notes: string | null
          id: string
          number: number
          site_id: string
          status: string | null
          weather_afternoon: string | null
          weather_morning: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          condition_afternoon?: string | null
          condition_morning?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          general_notes?: string | null
          id?: string
          number: number
          site_id: string
          status?: string | null
          weather_afternoon?: string | null
          weather_morning?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          condition_afternoon?: string | null
          condition_morning?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          general_notes?: string | null
          id?: string
          number?: number
          site_id?: string
          status?: string | null
          weather_afternoon?: string | null
          weather_morning?: string | null
        }
        Relationships: []
      }
      media: {
        Row: {
          caption: string | null
          created_at: string | null
          daily_report_id: string | null
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          kind: string
          site_id: string
          size_bytes: number | null
          storage_path: string
          taken_at: string | null
          taken_by: string | null
          thumbnail_path: string | null
          wbs_item_id: string | null
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          daily_report_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          kind: string
          site_id: string
          size_bytes?: number | null
          storage_path: string
          taken_at?: string | null
          taken_by?: string | null
          thumbnail_path?: string | null
          wbs_item_id?: string | null
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          daily_report_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          kind?: string
          site_id?: string
          size_bytes?: number | null
          storage_path?: string
          taken_at?: string | null
          taken_by?: string | null
          thumbnail_path?: string | null
          wbs_item_id?: string | null
          width?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          archived_at: string | null
          body: string | null
          created_at: string | null
          id: string
          kind: string
          link: string | null
          organization_id: string
          read_at: string | null
          recipient_id: string
          related_id: string | null
          related_table: string | null
          snoozed_until: string | null
          title: string
        }
        Insert: {
          archived_at?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          kind: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          recipient_id: string
          related_id?: string | null
          related_table?: string | null
          snoozed_until?: string | null
          title: string
        }
        Update: {
          archived_at?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          kind?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          recipient_id?: string
          related_id?: string | null
          related_table?: string | null
          snoozed_until?: string | null
          title?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string | null
          organization_id: string
          profile_id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          organization_id: string
          profile_id: string
          role: string
        }
        Update: {
          created_at?: string | null
          organization_id?: string
          profile_id?: string
          role?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          brand_color: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          plan: string | null
          slug: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: string | null
          slug: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string | null
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          default_org_id: string | null
          full_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_org_id?: string | null
          full_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_org_id?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      report_activities: {
        Row: {
          daily_report_id: string
          description: string
          id: string
          notes: string | null
          progress_pct: number | null
          wbs_item_id: string | null
        }
        Insert: {
          daily_report_id: string
          description: string
          id?: string
          notes?: string | null
          progress_pct?: number | null
          wbs_item_id?: string | null
        }
        Update: {
          daily_report_id?: string
          description?: string
          id?: string
          notes?: string | null
          progress_pct?: number | null
          wbs_item_id?: string | null
        }
        Relationships: []
      }
      report_equipment: {
        Row: {
          daily_report_id: string
          hours: number | null
          id: string
          name: string
        }
        Insert: {
          daily_report_id: string
          hours?: number | null
          id?: string
          name: string
        }
        Update: {
          daily_report_id?: string
          hours?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      report_workforce: {
        Row: {
          count: number
          daily_report_id: string
          id: string
          role: string
        }
        Insert: {
          count: number
          daily_report_id: string
          id?: string
          role: string
        }
        Update: {
          count?: number
          daily_report_id?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          address: string | null
          client_name: string | null
          contract_days: number | null
          contract_number: string | null
          cover_url: string | null
          created_at: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          responsible_id: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          contract_days?: number | null
          contract_number?: string | null
          cover_url?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          responsible_id?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          client_name?: string | null
          contract_days?: number | null
          contract_number?: string | null
          cover_url?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          responsible_id?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: []
      }
      wbs_items: {
        Row: {
          assignee_id: string | null
          code: string
          created_at: string | null
          due_date: string | null
          id: string
          name: string
          parent_id: string | null
          position: number | null
          progress_pct: number | null
          site_id: string
          start_date: string | null
          status: string | null
          weight: number | null
        }
        Insert: {
          assignee_id?: string | null
          code: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number | null
          progress_pct?: number | null
          site_id: string
          start_date?: string | null
          status?: string | null
          weight?: number | null
        }
        Update: {
          assignee_id?: string | null
          code?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number | null
          progress_pct?: number | null
          site_id?: string
          start_date?: string | null
          status?: string | null
          weight?: number | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      current_user_admin_orgs: { Args: never; Returns: string[] }
      current_user_orgs: { Args: never; Returns: string[] }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
