export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          summary: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          summary: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          summary?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_accounts: {
        Row: {
          created_at: string
          created_by: string | null
          external_account_id: string | null
          id: string
          label: string
          last_error: string | null
          last_success_at: string | null
          last_sync_at: string | null
          metadata: Json
          organization_id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_account_id?: string | null
          id?: string
          label: string
          last_error?: string | null
          last_success_at?: string | null
          last_sync_at?: string | null
          metadata?: Json
          organization_id: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_account_id?: string | null
          id?: string
          label?: string
          last_error?: string | null
          last_success_at?: string | null
          last_sync_at?: string | null
          metadata?: Json
          organization_id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          external_id: string | null
          external_provider: string | null
          external_url: string | null
          general_notes: string | null
          id: string
          last_synced_at: string | null
          number: number
          site_id: string
          status: string | null
          sync_metadata: Json
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
          external_id?: string | null
          external_provider?: string | null
          external_url?: string | null
          general_notes?: string | null
          id?: string
          last_synced_at?: string | null
          number: number
          site_id: string
          status?: string | null
          sync_metadata?: Json
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
          external_id?: string | null
          external_provider?: string | null
          external_url?: string | null
          general_notes?: string | null
          id?: string
          last_synced_at?: string | null
          number?: number
          site_id?: string
          status?: string | null
          sync_metadata?: Json
          weather_afternoon?: string | null
          weather_morning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          caption: string | null
          created_at: string | null
          daily_report_id: string | null
          external_id: string | null
          external_provider: string | null
          external_url: string | null
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          kind: string
          last_synced_at: string | null
          site_id: string
          size_bytes: number | null
          storage_path: string
          sync_metadata: Json
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
          external_id?: string | null
          external_provider?: string | null
          external_url?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          kind: string
          last_synced_at?: string | null
          site_id: string
          size_bytes?: number | null
          storage_path: string
          sync_metadata?: Json
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
          external_id?: string | null
          external_provider?: string | null
          external_url?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          kind?: string
          last_synced_at?: string | null
          site_id?: string
          size_bytes?: number | null
          storage_path?: string
          sync_metadata?: Json
          taken_at?: string | null
          taken_by?: string | null
          thumbnail_path?: string | null
          wbs_item_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_taken_by_fkey"
            columns: ["taken_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_wbs_item_id_fkey"
            columns: ["wbs_item_id"]
            isOneToOne: false
            referencedRelation: "wbs_items"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      pending_invites: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          default_org_id: string | null
          full_name: string
          id: string
          is_platform_admin: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_org_id?: string | null
          full_name: string
          id: string
          is_platform_admin?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_org_id?: string | null
          full_name?: string
          id?: string
          is_platform_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_org_id_fkey"
            columns: ["default_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "report_activities_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_activities_wbs_item_id_fkey"
            columns: ["wbs_item_id"]
            isOneToOne: false
            referencedRelation: "wbs_items"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "report_equipment_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "report_workforce_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
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
          external_id: string | null
          external_provider: string | null
          external_url: string | null
          id: string
          last_synced_at: string | null
          name: string
          organization_id: string
          responsible_id: string | null
          start_date: string | null
          status: string
          sync_metadata: Json
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          contract_days?: number | null
          contract_number?: string | null
          cover_url?: string | null
          created_at?: string | null
          end_date?: string | null
          external_id?: string | null
          external_provider?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          organization_id: string
          responsible_id?: string | null
          start_date?: string | null
          status?: string
          sync_metadata?: Json
        }
        Update: {
          address?: string | null
          client_name?: string | null
          contract_days?: number | null
          contract_number?: string | null
          cover_url?: string | null
          created_at?: string | null
          end_date?: string | null
          external_id?: string | null
          external_provider?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          responsible_id?: string | null
          start_date?: string | null
          status?: string
          sync_metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          created_at: string
          error: string | null
          external_account_id: string | null
          finished_at: string | null
          id: string
          organization_id: string
          provider: string
          requested_by: string | null
          scope: string
          started_at: string | null
          stats: Json
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_account_id?: string | null
          finished_at?: string | null
          id?: string
          organization_id: string
          provider: string
          requested_by?: string | null
          scope?: string
          started_at?: string | null
          stats?: Json
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          external_account_id?: string | null
          finished_at?: string | null
          id?: string
          organization_id?: string
          provider?: string
          requested_by?: string | null
          scope?: string
          started_at?: string | null
          stats?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_external_account_id_fkey"
            columns: ["external_account_id"]
            isOneToOne: false
            referencedRelation: "external_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wbs_items: {
        Row: {
          assignee_id: string | null
          code: string
          created_at: string | null
          due_date: string | null
          external_id: string | null
          external_provider: string | null
          external_url: string | null
          id: string
          last_synced_at: string | null
          name: string
          parent_id: string | null
          position: number | null
          progress_pct: number | null
          site_id: string
          start_date: string | null
          status: string | null
          sync_metadata: Json
          weight: number | null
        }
        Insert: {
          assignee_id?: string | null
          code: string
          created_at?: string | null
          due_date?: string | null
          external_id?: string | null
          external_provider?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          parent_id?: string | null
          position?: number | null
          progress_pct?: number | null
          site_id: string
          start_date?: string | null
          status?: string | null
          sync_metadata?: Json
          weight?: number | null
        }
        Update: {
          assignee_id?: string | null
          code?: string
          created_at?: string | null
          due_date?: string | null
          external_id?: string | null
          external_provider?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          parent_id?: string | null
          position?: number | null
          progress_pct?: number | null
          site_id?: string
          start_date?: string | null
          status?: string | null
          sync_metadata?: Json
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wbs_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbs_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "wbs_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbs_items_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audit_log_event: {
        Args: {
          p_action: string
          p_actor_id: string
          p_metadata?: Json
          p_organization_id: string
          p_summary: string
          p_target_id: string
          p_target_table: string
        }
        Returns: undefined
      }
      can_access_daily_report: {
        Args: { target_daily_report_id: string }
        Returns: boolean
      }
      can_access_profile: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      can_access_site: { Args: { target_site_id: string }; Returns: boolean }
      can_write_daily_report: {
        Args: { target_daily_report_id: string }
        Returns: boolean
      }
      can_write_site: { Args: { target_site_id: string }; Returns: boolean }
      consume_pending_invites: { Args: never; Returns: undefined }
      consume_pending_invites_for_user: {
        Args: { target_email: string; target_user_id: string }
        Returns: undefined
      }
      create_daily_report: {
        Args: {
          p_condition_afternoon?: string
          p_condition_morning?: string
          p_general_notes?: string
          p_weather_afternoon?: string
          p_weather_morning?: string
          report_date: string
          target_site_id: string
        }
        Returns: string
      }
      current_user_admin_orgs: { Args: never; Returns: string[] }
      current_user_orgs: { Args: never; Returns: string[] }
      current_user_writer_orgs: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
