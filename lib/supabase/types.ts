/**
 * Supabase Database TypeScript types — auto-generated placeholder.
 *
 * To generate real types from your live Supabase project, run:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts
 *
 * Until then, this provides a typed Database interface that matches the schema in
 * supabase/migrations/20260531_conduit_v2_schema.sql.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          clerk_org_id: string;
          name: string;
          nmls_company_id: string | null;
          licensed_states: string[];
          billing_email: string | null;
          subscription_plan: 'starter' | 'growth' | 'team';
          subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['organizations']['Row']> & {
          clerk_org_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Row']>;
      };
      profiles: {
        Row: {
          id: string;
          clerk_user_id: string;
          org_id: string | null;
          email: string;
          first_name: string;
          last_name: string;
          role: 'admin' | 'branch_manager' | 'loan_officer' | 'processor';
          nmls_id: string | null;
          phone: string | null;
          avatar_url: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          clerk_user_id: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      leads: {
        Row: {
          id: string;
          org_id: string;
          assigned_to: string | null;
          stage: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          date_of_birth: string | null;
          sms_consent: boolean;
          sms_consent_obtained_at: string | null;
          sms_consent_ip: string | null;
          sms_consent_text: string | null;
          unsubscribed_email: boolean;
          unsubscribed_at: string | null;
          ssn_encrypted: string | null;
          ssn_iv: string | null;
          income_encrypted: string | null;
          income_iv: string | null;
          credit_score: number | null;
          loan_type: string | null;
          loan_purpose: string | null;
          loan_amount: number | null;
          property_address: string | null;
          property_city: string | null;
          property_state: string | null;
          property_zip: string | null;
          property_type: string | null;
          occupancy_type: string | null;
          estimated_value: number | null;
          down_payment: number | null;
          ltv: number | null;
          application_submitted_at: string | null;
          le_deadline: string | null;
          loan_estimate_sent_at: string | null;
          intent_to_proceed_at: string | null;
          cd_deadline: string | null;
          closing_disclosure_sent_at: string | null;
          closing_date: string | null;
          ai_score: number | null;
          ai_score_updated_at: string | null;
          pipeline_value: number | null;
          lead_source: string | null;
          referral_partner_id: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          first_contacted_at: string | null;
          last_contacted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['leads']['Row']> & {
          org_id: string;
          first_name: string;
          last_name: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['leads']['Row']>;
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          org_id: string;
          author_id: string;
          content: string;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['lead_notes']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['lead_notes']['Row']>;
      };
      lead_tasks: {
        Row: {
          id: string;
          lead_id: string;
          org_id: string;
          assigned_to: string | null;
          title: string;
          description: string | null;
          due_date: string | null;
          completed: boolean;
          completed_at: string | null;
          priority: 'low' | 'medium' | 'high' | 'urgent';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['lead_tasks']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['lead_tasks']['Row']>;
      };
      lead_activities: {
        Row: {
          id: string;
          lead_id: string;
          org_id: string;
          actor_id: string | null;
          action: string;
          description: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['lead_activities']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
      documents: {
        Row: {
          id: string;
          lead_id: string;
          org_id: string;
          uploaded_by: string;
          document_type: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          storage_path: string;
          ai_extracted: boolean;
          ai_summary: string | null;
          verified: boolean;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Row']>;
      };
      communications: {
        Row: {
          id: string;
          lead_id: string;
          org_id: string;
          sender_id: string;
          channel: 'email' | 'sms' | 'call' | 'note';
          direction: 'outbound' | 'inbound';
          subject: string | null;
          body: string;
          sent_at: string | null;
          delivered_at: string | null;
          opened_at: string | null;
          consent_status_at_send: boolean;
          resend_message_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['communications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['communications']['Row']>;
      };
      referral_partners: {
        Row: {
          id: string;
          org_id: string;
          added_by: string;
          type: 'realtor' | 'builder' | 'cpa' | 'attorney' | 'financial_advisor' | 'other';
          company_name: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          license_number: string | null;
          website: string | null;
          notes: string | null;
          referral_count: number;
          closed_count: number;
          total_volume: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['referral_partners']['Row'], 'id' | 'created_at' | 'updated_at' | 'referral_count' | 'closed_count' | 'total_volume'>;
        Update: Partial<Database['public']['Tables']['referral_partners']['Row']>;
      };
      campaigns: {
        Row: {
          id: string;
          org_id: string;
          created_by: string;
          name: string;
          description: string | null;
          type: 'drip' | 'blast' | 'nurture';
          status: 'draft' | 'active' | 'paused' | 'archived';
          trigger_stage: string | null;
          total_steps: number;
          enrolled_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['campaigns']['Row'], 'id' | 'created_at' | 'updated_at' | 'total_steps' | 'enrolled_count'>;
        Update: Partial<Database['public']['Tables']['campaigns']['Row']>;
      };
      audit_events: {
        Row: {
          id: string;
          org_id: string | null;
          actor_id: string;
          action: string;
          resource_type: string;
          resource_id: string | null;
          before_state: Json | null;
          after_state: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_events']['Row'], 'id' | 'created_at'>;
        Update: never; // append-only
      };
      pii_access_log: {
        Row: {
          id: string;
          org_id: string | null;
          accessor_id: string;
          lead_id: string | null;
          fields_accessed: string[];
          purpose: string;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['pii_access_log']['Row'], 'id' | 'created_at'>;
        Update: never; // append-only
      };
      tcpa_consent_log: {
        Row: {
          id: string;
          org_id: string | null;
          lead_id: string | null;
          channel: 'sms' | 'call' | 'email';
          consent_given: boolean;
          consent_method: 'web_form' | 'verbal' | 'written' | 'opt_in_text';
          consent_language: string;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tcpa_consent_log']['Row'], 'id' | 'created_at'>;
        Update: never; // append-only
      };
      rate_limits: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          window_start: string;
          count: number;
        };
        Insert: Omit<Database['public']['Tables']['rate_limits']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['rate_limits']['Row']>;
      };
      ai_feedback: {
        Row: {
          id: string;
          org_id: string | null;
          user_id: string;
          lead_id: string | null;
          field_type: string;
          prompt_used: string;
          ai_output: string;
          user_action: 'accepted' | 'rejected' | 'modified' | 'ignored';
          final_text: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_feedback']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['ai_feedback']['Row']>;
      };
      notification_reads: {
        Row: {
          id: string;
          org_id: string | null;
          user_id: string;
          notification_type: string;
          reference_id: string | null;
          read_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notification_reads']['Row'], 'id' | 'read_at'>;
        Update: Partial<Database['public']['Tables']['notification_reads']['Row']>;
      };
      mfa_status: {
        Row: {
          clerk_user_id: string;
          org_id: string | null;
          mfa_enabled: boolean;
          last_verified: string | null;
          updated_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['mfa_status']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['mfa_status']['Row']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_org_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
