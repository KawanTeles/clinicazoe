export type Role = "admin" | "recepcionista" | "profissional" | "paciente";
export type Status = "active" | "inactive";
export type PaymentMethod = "cartao" | "pix" | "dinheiro" | "convenio";
export type AppointmentStatus =
  | "pendente"
  | "confirmada"
  | "cancelada"
  | "remarcada"
  | "concluida"
  | "faltou"
  | "recusada";
export type AppointmentSource = "paciente" | "site_publico" | "staff";
export type FinancialStatus = "em_aberto" | "pago";
export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";
export type SeriesStatus = "active" | "cancelled";

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
          consultation_duration_minutes: number;
          price_particular_card: number | null;
          price_particular_pix: number | null;
          price_particular_cash: number | null;
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
          consultation_duration_minutes?: number;
          price_particular_card?: number | null;
          price_particular_pix?: number | null;
          price_particular_cash?: number | null;
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
          consultation_duration_minutes?: number;
          price_particular_card?: number | null;
          price_particular_pix?: number | null;
          price_particular_cash?: number | null;
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
          capacity: number;
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
          capacity?: number;
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
          capacity?: number;
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
        Row: {
          professional_id: string;
          insurance_id: string;
          value: number;
          duration_minutes: number | null;
        };
        Insert: {
          professional_id: string;
          insurance_id: string;
          value?: number;
          duration_minutes?: number | null;
        };
        Update: {
          professional_id?: string;
          insurance_id?: string;
          value?: number;
          duration_minutes?: number | null;
        };
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
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          professional_id: string;
          specialty_id: string | null;
          insurance_id: string;
          schedule_slot_id: string;
          appointment_date: string;
          start_time: string;
          end_time: string;
          payment_method: PaymentMethod;
          value: number;
          status: AppointmentStatus;
          source: AppointmentSource;
          notes: string | null;
          series_id: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          professional_id: string;
          specialty_id?: string | null;
          insurance_id: string;
          schedule_slot_id: string;
          appointment_date: string;
          start_time: string;
          end_time: string;
          payment_method: PaymentMethod;
          value: number;
          status?: AppointmentStatus;
          source?: AppointmentSource;
          notes?: string | null;
          series_id?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          professional_id?: string;
          specialty_id?: string | null;
          insurance_id?: string;
          schedule_slot_id?: string;
          appointment_date?: string;
          start_time?: string;
          end_time?: string;
          payment_method?: PaymentMethod;
          value?: number;
          status?: AppointmentStatus;
          source?: AppointmentSource;
          notes?: string | null;
          series_id?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      financial_entries: {
        Row: {
          id: string;
          appointment_id: string;
          patient_id: string;
          professional_id: string;
          insurance_id: string | null;
          value: number;
          payment_method: PaymentMethod;
          due_date: string;
          status: FinancialStatus;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          patient_id: string;
          professional_id: string;
          insurance_id?: string | null;
          value: number;
          payment_method: PaymentMethod;
          due_date: string;
          status?: FinancialStatus;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          patient_id?: string;
          professional_id?: string;
          insurance_id?: string | null;
          value?: number;
          payment_method?: PaymentMethod;
          due_date?: string;
          status?: FinancialStatus;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedule_exceptions: {
        Row: {
          id: string;
          professional_id: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          professional_id?: string;
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          entity: string | null;
          entity_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          entity?: string | null;
          entity_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          entity?: string | null;
          entity_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      patient_details: {
        Row: {
          id: string;
          cpf: string | null;
          birth_date: string | null;
          email: string | null;
          whatsapp: string | null;
          address: string | null;
          city: string | null;
          preferred_insurance_id: string | null;
          insurance_card_number: string | null;
          insurance_card_valid_until: string | null;
          notes: string | null;
          preferred_professional_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          cpf?: string | null;
          birth_date?: string | null;
          email?: string | null;
          whatsapp?: string | null;
          address?: string | null;
          city?: string | null;
          preferred_insurance_id?: string | null;
          insurance_card_number?: string | null;
          insurance_card_valid_until?: string | null;
          notes?: string | null;
          preferred_professional_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cpf?: string | null;
          birth_date?: string | null;
          email?: string | null;
          whatsapp?: string | null;
          address?: string | null;
          city?: string | null;
          preferred_insurance_id?: string | null;
          insurance_card_number?: string | null;
          insurance_card_valid_until?: string | null;
          notes?: string | null;
          preferred_professional_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      appointment_series: {
        Row: {
          id: string;
          patient_id: string;
          professional_id: string;
          specialty_id: string | null;
          insurance_id: string;
          payment_method: PaymentMethod;
          day_of_week: number;
          start_time: string;
          end_time: string;
          frequency: RecurrenceFrequency;
          start_date: string;
          end_date: string | null;
          max_occurrences: number | null;
          status: SeriesStatus;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          professional_id: string;
          specialty_id?: string | null;
          insurance_id: string;
          payment_method: PaymentMethod;
          day_of_week: number;
          start_time: string;
          end_time: string;
          frequency: RecurrenceFrequency;
          start_date: string;
          end_date?: string | null;
          max_occurrences?: number | null;
          status?: SeriesStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          professional_id?: string;
          specialty_id?: string | null;
          insurance_id?: string;
          payment_method?: PaymentMethod;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          frequency?: RecurrenceFrequency;
          start_date?: string;
          end_date?: string | null;
          max_occurrences?: number | null;
          status?: SeriesStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patient_messages: {
        Row: {
          id: string;
          patient_id: string;
          appointment_id: string | null;
          type: string;
          sent_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          appointment_id?: string | null;
          type: string;
          sent_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          appointment_id?: string | null;
          type?: string;
          sent_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      clinic_holidays: {
        Row: {
          id: string;
          date: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          description?: string | null;
          created_at?: string;
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
