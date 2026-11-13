/**
 * Tipos de la base de datos, derivados de `supabase/migrations/`.
 *
 * Regenerar con la CLI cuando haya acceso al proyecto:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string;
          read_at: string;
          user_id: string;
        };
        Insert: {
          announcement_id: string;
          read_at?: string;
          user_id?: string;
        };
        Update: {
          announcement_id?: string;
          read_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          audience: string;
          author_id: string | null;
          body: string;
          content: Json | null;
          draft: boolean;
          notified_at: string | null;
          edited_at: string | null;
          id: string;
          pinned: boolean;
          published_at: string;
          title: string;
          tower: string | null;
        };
        Insert: {
          audience?: string;
          author_id?: string | null;
          body: string;
          content?: Json | null;
          draft?: boolean;
          notified_at?: string | null;
          edited_at?: string | null;
          id?: string;
          pinned?: boolean;
          published_at?: string;
          title: string;
          tower?: string | null;
        };
        Update: {
          audience?: string | null;
          author_id?: string | null;
          body?: string;
          content?: Json | null;
          draft?: boolean;
          notified_at?: string | null;
          edited_at?: string | null;
          id?: string;
          pinned?: boolean;
          published_at?: string;
          title?: string;
          tower?: string | null;
        };
        Relationships: [];
      };
      assembly_reminders: {
        Row: {
          assembly_id: string;
          id: string;
          message: string | null;
          remind_at: string;
          sent_at: string | null;
        };
        Insert: {
          assembly_id: string;
          id?: string;
          message?: string | null;
          remind_at: string;
          sent_at?: string | null;
        };
        Update: {
          assembly_id?: string;
          id?: string;
          message?: string | null;
          remind_at?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assembly_reminders_assembly_id_fkey";
            columns: ["assembly_id"];
            isOneToOne: false;
            referencedRelation: "assemblies";
            referencedColumns: ["id"];
          },
        ];
      };
      assemblies: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: string;
          location: string | null;
          meeting_url: string | null;
          scheduled_at: string;
          status: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          kind?: string;
          location?: string | null;
          meeting_url?: string | null;
          scheduled_at: string;
          status?: string;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          kind?: string | null;
          location?: string | null;
          meeting_url?: string | null;
          scheduled_at?: string;
          status?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      vehicle_access_log: {
        Row: {
          at: string;
          direction: string;
          id: string;
          method: string;
          plate: string;
          recorded_by: string | null;
          result: string;
          transcript: string | null;
          unit_id: string | null;
          vehicle_id: string | null;
          voided_at: string | null;
        };
        Insert: {
          at?: string;
          direction: string;
          id?: string;
          method?: string;
          plate: string;
          recorded_by?: string | null;
          result: string;
          transcript?: string | null;
          unit_id?: string | null;
          vehicle_id?: string | null;
          voided_at?: string | null;
        };
        Update: {
          at?: string;
          direction?: string;
          id?: string;
          method?: string;
          plate?: string;
          recorded_by?: string | null;
          result?: string;
          transcript?: string | null;
          unit_id?: string | null;
          vehicle_id?: string | null;
          voided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_access_log_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_access_log_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          active: boolean;
          brand: string | null;
          color: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          photo_path: string | null;
          plate: string;
          unit_id: string;
        };
        Insert: {
          active?: boolean;
          brand?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          photo_path?: string | null;
          plate: string;
          unit_id: string;
        };
        Update: {
          active?: boolean;
          brand?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          photo_path?: string | null;
          plate?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      units: {
        Row: {
          floor: number | null;
          id: string;
          number: string;
          tower: string;
        };
        Insert: {
          floor?: number | null;
          id?: string;
          number: string;
          tower?: string;
        };
        Update: {
          floor?: number | null;
          id?: string;
          number?: string;
          tower?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          label: string | null;
          max_uses: number;
          revoked_at: string | null;
          role: string;
          token_hash: string;
          unit_id: string | null;
          uses: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          label?: string | null;
          max_uses?: number;
          revoked_at?: string | null;
          role?: string;
          token_hash: string;
          unit_id?: string | null;
          uses?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          label?: string | null;
          max_uses?: number;
          revoked_at?: string | null;
          role?: string;
          token_hash?: string;
          unit_id?: string | null;
          uses?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          announcement_id: string | null;
          assembly_id: string | null;
          created_at: string;
          created_by: string | null;
          file_path: string;
          id: string;
          name: string;
          size_bytes: number;
        };
        Insert: {
          announcement_id?: string | null;
          assembly_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_path: string;
          id?: string;
          name: string;
          size_bytes: number;
        };
        Update: {
          announcement_id?: string | null;
          assembly_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_path?: string;
          id?: string;
          name?: string;
          size_bytes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "attachments_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_assembly_id_fkey";
            columns: ["assembly_id"];
            isOneToOne: false;
            referencedRelation: "assemblies";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_options: {
        Row: {
          id: string;
          label: string;
          poll_id: string;
          position: number;
        };
        Insert: {
          id?: string;
          label: string;
          poll_id: string;
          position?: number;
        };
        Update: {
          id?: string;
          label?: string;
          poll_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_votes: {
        Row: {
          option_id: string;
          poll_id: string;
          unit_id: string;
          voted_at: string;
          voted_by: string | null;
        };
        Insert: {
          option_id: string;
          poll_id: string;
          unit_id: string;
          voted_at?: string;
          voted_by?: string | null;
        };
        Update: {
          option_id?: string;
          poll_id?: string;
          unit_id?: string;
          voted_at?: string;
          voted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "poll_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_votes_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      polls: {
        Row: {
          assembly_id: string;
          closed_at: string | null;
          closes_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          mode: string;
          question: string;
          reminder_sent_at: string | null;
          results_sent_at: string | null;
          status: string;
        };
        Insert: {
          assembly_id: string;
          closed_at?: string | null;
          closes_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          mode?: string;
          question: string;
          reminder_sent_at?: string | null;
          results_sent_at?: string | null;
          status?: string;
        };
        Update: {
          assembly_id?: string;
          closed_at?: string | null;
          closes_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          mode?: string;
          question?: string;
          reminder_sent_at?: string | null;
          results_sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "polls_assembly_id_fkey";
            columns: ["assembly_id"];
            isOneToOne: false;
            referencedRelation: "assemblies";
            referencedColumns: ["id"];
          },
        ];
      };
      directory_entries: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          has_whatsapp: boolean;
          id: string;
          name: string;
          phone: string | null;
          schedule: string | null;
          sort_order: number;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description?: string | null;
          has_whatsapp?: boolean;
          id?: string;
          name: string;
          phone?: string | null;
          schedule?: string | null;
          sort_order?: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          has_whatsapp?: boolean;
          id?: string;
          name?: string;
          phone?: string | null;
          schedule?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      invitation_redemptions: {
        Row: {
          id: string;
          invitation_id: string;
          redeemed_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          redeemed_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          invitation_id?: string;
          redeemed_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitation_redemptions_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitation_redemptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      packages: {
        Row: {
          carrier: string | null;
          delivered_at: string | null;
          delivered_to: string | null;
          description: string | null;
          id: string;
          notes: string | null;
          photo_path: string | null;
          received_at: string;
          received_by: string | null;
          recipient_name: string | null;
          status: string;
          unit_id: string;
        };
        Insert: {
          carrier?: string | null;
          delivered_at?: string | null;
          delivered_to?: string | null;
          description?: string | null;
          id?: string;
          notes?: string | null;
          photo_path?: string | null;
          received_at?: string;
          received_by?: string | null;
          recipient_name?: string | null;
          status?: string;
          unit_id: string;
        };
        Update: {
          carrier?: string | null;
          delivered_at?: string | null;
          delivered_to?: string | null;
          description?: string | null;
          id?: string;
          notes?: string | null;
          photo_path?: string | null;
          received_at?: string;
          received_by?: string | null;
          recipient_name?: string | null;
          status?: string | null;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packages_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      amenities: {
        Row: {
          active: boolean;
          capacity: number | null;
          close_time: string;
          deposit_cop: number;
          description: string | null;
          id: string;
          max_hours: number;
          name: string;
          open_time: string;
        };
        Insert: {
          active?: boolean;
          capacity?: number | null;
          close_time?: string;
          deposit_cop?: number;
          description?: string | null;
          id?: string;
          max_hours?: number;
          name: string;
          open_time?: string;
        };
        Update: {
          active?: boolean;
          capacity?: number | null;
          close_time?: string;
          deposit_cop?: number;
          description?: string | null;
          id?: string;
          max_hours?: number;
          name?: string;
          open_time?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          role: string;
          unit_id: string | null;
          whatsapp_opt_in: boolean;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          phone?: string | null;
          role?: string;
          unit_id?: string | null;
          whatsapp_opt_in?: boolean;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          role?: string | null;
          unit_id?: string | null;
          whatsapp_opt_in?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          amenity_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          notes: string | null;
          starts_at: string;
          status: string;
          unit_id: string;
          user_id: string;
        };
        Insert: {
          amenity_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          notes?: string | null;
          starts_at: string;
          status?: string;
          unit_id: string;
          user_id?: string;
        };
        Update: {
          amenity_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          notes?: string | null;
          starts_at?: string;
          status?: string | null;
          unit_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_amenity_id_fkey";
            columns: ["amenity_id"];
            isOneToOne: false;
            referencedRelation: "amenities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      update_my_contact: { Args: { p_phone: string; p_whatsapp: boolean }; Returns: string };
      cast_vote: { Args: { p_option: string; p_poll: string }; Returns: string };
      poll_participation: { Args: { p_poll: string }; Returns: { total: number; voted: number }[] };
      poll_results: { Args: { p_poll: string }; Returns: { option_id: string; votes: number }[] };
      invitation_info: {
        Args: { p_token: string };
        Returns: {
          expires_at: string | null;
          reason: string;
          role: string | null;
          unit_label: string | null;
          valid: boolean;
        }[];
      };
      redeem_invitation: { Args: { p_token: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
