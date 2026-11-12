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
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          phone?: string | null;
          role?: string;
          unit_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          role?: string | null;
          unit_id?: string | null;
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
