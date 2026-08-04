export type Role = "admin" | "recepcionista" | "profissional" | "paciente";
export type Status = "active" | "inactive";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_path: string | null;
          role: Role;
          status: Status;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          role?: Role;
          status?: Status;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
          role?: Role;
          status?: Status;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: number;
          role: Role;
          permission: string;
          allowed: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          role: Role;
          permission: string;
          allowed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          role?: Role;
          permission?: string;
          allowed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      professionals: {
        Row: {
          id: string;
          specialty_id: string | null;
          license_number: string | null;
          bio: string | null;
          agenda_color: string;
          status: Status;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          specialty_id?: string | null;
          license_number?: string | null;
          bio?: string | null;
          agenda_color?: string;
          status?: Status;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          specialty_id?: string | null;
          license_number?: string | null;
          bio?: string | null;
          agenda_color?: string;
          status?: Status;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clinic_settings: {
        Row: {
          id: number;
          name: string;
          whatsapp_number: string | null;
          address: string | null;
          logo_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name?: string;
          whatsapp_number?: string | null;
          address?: string | null;
          logo_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          whatsapp_number?: string | null;
          address?: string | null;
          logo_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      insurances: {
        Row: {
          id: string;
          name: string;
          status: Status;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          status?: Status;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          status?: Status;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedule_slots: {
        Row: {
          id: string;
          professional_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          status: Status;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          status?: Status;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          professional_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          status?: Status;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedule_slot_insurances: {
        Row: { slot_id: string; insurance_id: string };
        Insert: { slot_id: string; insurance_id: string };
        Update: { slot_id?: string; insurance_id?: string };
        Relationships: [];
      };
      professional_insurances: {
        Row: { professional_id: string; insurance_id: string };
        Insert: { professional_id: string; insurance_id: string };
        Update: { professional_id?: string; insurance_id?: string };
        Relationships: [];
      };
      specialties: {
        Row: {
          id: string;
          name: string;
          status: Status;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          status?: Status;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          status?: Status;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
