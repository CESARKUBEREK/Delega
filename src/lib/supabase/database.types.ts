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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_budget_alerts: {
        Row: {
          created_at: string
          level: number
          period: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          level: number
          period: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          level?: number
          period?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_budget_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_connections: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          key_hint: string
          last_validated_at: string
          model: string
          provider: string
          status: string
          updated_at: string
          vault_secret_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          key_hint: string
          last_validated_at?: string
          model: string
          provider: string
          status?: string
          updated_at?: string
          vault_secret_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          key_hint?: string
          last_validated_at?: string
          model?: string
          provider?: string
          status?: string
          updated_at?: string
          vault_secret_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
          target_type: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
          target_type: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_email: string | null
          city: string | null
          country_code: string
          created_at: string
          customer_type: string
          id: string
          legal_name: string | null
          owner_user_id: string | null
          postal_code: string | null
          preferred_language: string
          region: string | null
          tax_id: string | null
          tax_id_type: string | null
          tax_id_verified_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          country_code: string
          created_at?: string
          customer_type: string
          id?: string
          legal_name?: string | null
          owner_user_id?: string | null
          postal_code?: string | null
          preferred_language?: string
          region?: string | null
          tax_id?: string | null
          tax_id_type?: string | null
          tax_id_verified_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          customer_type?: string
          id?: string
          legal_name?: string | null
          owner_user_id?: string | null
          postal_code?: string | null
          preferred_language?: string
          region?: string | null
          tax_id?: string | null
          tax_id_type?: string | null
          tax_id_verified_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          active: boolean
          capabilities: Json
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          capabilities?: Json
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          capabilities?: Json
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      checkout_sessions: {
        Row: {
          amount_minor: number
          billing_customer_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          expires_at: string
          id: string
          idempotency_key: string
          plan_price_id: string
          quote_snapshot: Json
          status: string
          workspace_id: string
        }
        Insert: {
          amount_minor: number
          billing_customer_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          expires_at: string
          id?: string
          idempotency_key: string
          plan_price_id: string
          quote_snapshot: Json
          status?: string
          workspace_id: string
        }
        Update: {
          amount_minor?: number
          billing_customer_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          plan_price_id?: string
          quote_snapshot?: Json
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_billing_customer_id_workspace_id_fkey"
            columns: ["billing_customer_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "checkout_sessions_plan_price_id_fkey"
            columns: ["plan_price_id"]
            isOneToOne: false
            referencedRelation: "plan_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          checkout_session_id: string | null
          context: Json
          decision: string
          document_sha256: string
          document_type: string
          document_version: string
          id: string
          legal_document_id: string | null
          purpose: string
          recorded_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          checkout_session_id?: string | null
          context?: Json
          decision: string
          document_sha256: string
          document_type: string
          document_version: string
          id?: string
          legal_document_id?: string | null
          purpose: string
          recorded_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          checkout_session_id?: string | null
          context?: Json
          decision?: string
          document_sha256?: string
          document_type?: string
          document_version?: string
          id?: string
          legal_document_id?: string | null
          purpose?: string
          recorded_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_checkout_session_id_workspace_id_fkey"
            columns: ["checkout_session_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "consent_records_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_runs: {
        Row: {
          budget_usd: number | null
          cost_usd: number
          error: string | null
          file_ids: string[]
          finished_at: string | null
          flow_id: string | null
          flow_name: string
          id: string
          input_tokens: number
          lease_until: string | null
          model: string | null
          note: string
          output_tokens: number
          pending_action: Json | null
          plan: Json
          routing: Json | null
          routing_mode: string | null
          source_message_id: number | null
          started_at: string
          started_by: string | null
          state: Json
          status: string
          summary: string | null
          tool_calls: number
          trigger: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget_usd?: number | null
          cost_usd?: number
          error?: string | null
          file_ids?: string[]
          finished_at?: string | null
          flow_id?: string | null
          flow_name: string
          id?: string
          input_tokens?: number
          lease_until?: string | null
          model?: string | null
          note?: string
          output_tokens?: number
          pending_action?: Json | null
          plan: Json
          routing?: Json | null
          routing_mode?: string | null
          source_message_id?: number | null
          started_at?: string
          started_by?: string | null
          state?: Json
          status?: string
          summary?: string | null
          tool_calls?: number
          trigger?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget_usd?: number | null
          cost_usd?: number
          error?: string | null
          file_ids?: string[]
          finished_at?: string | null
          flow_id?: string | null
          flow_name?: string
          id?: string
          input_tokens?: number
          lease_until?: string | null
          model?: string | null
          note?: string
          output_tokens?: number
          pending_action?: Json | null
          plan?: Json
          routing?: Json | null
          routing_mode?: string | null
          source_message_id?: number | null
          started_at?: string
          started_by?: string | null
          state?: Json
          status?: string
          summary?: string | null
          tool_calls?: number
          trigger?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_runs_flow_id_workspace_id_fkey"
            columns: ["flow_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "flow_runs_source_message_fkey"
            columns: ["source_message_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "flow_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          name: string
          next_run_at: string | null
          settings: Json
          source_message_id: number | null
          status: string
          summary: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition: Json
          id?: string
          name: string
          next_run_at?: string | null
          settings?: Json
          source_message_id?: number | null
          status?: string
          summary?: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          name?: string
          next_run_at?: string | null
          settings?: Json
          source_message_id?: number | null
          status?: string
          summary?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flows_source_message_id_workspace_id_fkey"
            columns: ["source_message_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "flows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      help_voice_sessions: {
        Row: {
          id: string
          started_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          started_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          started_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_voice_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          direction: string
          external_id: string
          id: number
          integration_id: string | null
          recipients: string | null
          run_id: string | null
          sender_address: string | null
          sender_name: string | null
          sent_at: string
          subject: string | null
          thread_id: string
          workspace_id: string
        }
        Insert: {
          body?: string
          channel: string
          created_at?: string
          direction: string
          external_id: string
          id?: never
          integration_id?: string | null
          recipients?: string | null
          run_id?: string | null
          sender_address?: string | null
          sender_name?: string | null
          sent_at?: string
          subject?: string | null
          thread_id: string
          workspace_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          external_id?: string
          id?: never
          integration_id?: string | null
          recipients?: string | null
          run_id?: string | null
          sender_address?: string | null
          sender_name?: string | null
          sent_at?: string
          subject?: string | null
          thread_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_integration_id_workspace_id_fkey"
            columns: ["integration_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "inbox_messages_run_id_workspace_id_fkey"
            columns: ["run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "inbox_messages_thread_id_workspace_id_fkey"
            columns: ["thread_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "inbox_threads"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "inbox_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_rules: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          match_type: string
          value: string
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_type: string
          value: string
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_type?: string
          value?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_threads: {
        Row: {
          archived: boolean
          automatic: boolean
          category: string | null
          category_source: string | null
          channel: string
          classified_at: string | null
          classified_count: number
          client: string | null
          contact_address: string | null
          contact_name: string | null
          created_at: string
          external_id: string
          followup_muted: boolean
          id: string
          integration_id: string | null
          known_contact: boolean
          last_direction: string | null
          last_direction_at: string | null
          last_message_at: string | null
          manually_edited: boolean
          message_count: number
          needs_reply: boolean | null
          prepare_dismissed_at: string | null
          prepare_run_id: string | null
          project: string | null
          subject: string | null
          summary: string | null
          updated_at: string
          urgency: string | null
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          automatic?: boolean
          category?: string | null
          category_source?: string | null
          channel: string
          classified_at?: string | null
          classified_count?: number
          client?: string | null
          contact_address?: string | null
          contact_name?: string | null
          created_at?: string
          external_id: string
          followup_muted?: boolean
          id?: string
          integration_id?: string | null
          known_contact?: boolean
          last_direction?: string | null
          last_direction_at?: string | null
          last_message_at?: string | null
          manually_edited?: boolean
          message_count?: number
          needs_reply?: boolean | null
          prepare_dismissed_at?: string | null
          prepare_run_id?: string | null
          project?: string | null
          subject?: string | null
          summary?: string | null
          updated_at?: string
          urgency?: string | null
          workspace_id: string
        }
        Update: {
          archived?: boolean
          automatic?: boolean
          category?: string | null
          category_source?: string | null
          channel?: string
          classified_at?: string | null
          classified_count?: number
          client?: string | null
          contact_address?: string | null
          contact_name?: string | null
          created_at?: string
          external_id?: string
          followup_muted?: boolean
          id?: string
          integration_id?: string | null
          known_contact?: boolean
          last_direction?: string | null
          last_direction_at?: string | null
          last_message_at?: string | null
          manually_edited?: boolean
          message_count?: number
          needs_reply?: boolean | null
          prepare_dismissed_at?: string | null
          prepare_run_id?: string | null
          project?: string | null
          subject?: string | null
          summary?: string | null
          updated_at?: string
          urgency?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_threads_integration_id_workspace_id_fkey"
            columns: ["integration_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "inbox_threads_prepare_run_id_workspace_id_fkey"
            columns: ["prepare_run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "inbox_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_files: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          integration_id: string
          mime_type: string | null
          name: string
          provider_file_id: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          integration_id: string
          mime_type?: string | null
          name: string
          provider_file_id: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          integration_id?: string
          mime_type?: string | null
          name?: string
          provider_file_id?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_files_integration_id_workspace_id_fkey"
            columns: ["integration_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      integrations: {
        Row: {
          account_email: string | null
          config: Json
          created_at: string
          created_by: string | null
          id: string
          provider: string
          scopes: string
          status: string
          updated_at: string
          vault_secret_id: string
          workspace_id: string
        }
        Insert: {
          account_email?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          provider: string
          scopes?: string
          status?: string
          updated_at?: string
          vault_secret_id: string
          workspace_id: string
        }
        Update: {
          account_email?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          provider?: string
          scopes?: string
          status?: string
          updated_at?: string
          vault_secret_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: string
          content_sha256: string
          created_at: string
          document_type: string
          effective_from: string
          effective_until: string | null
          id: string
          jurisdiction: string
          language: string
          published: boolean
          title: string
          version: string
        }
        Insert: {
          content: string
          content_sha256: string
          created_at?: string
          document_type: string
          effective_from: string
          effective_until?: string | null
          id?: string
          jurisdiction?: string
          language: string
          published?: boolean
          title: string
          version: string
        }
        Update: {
          content?: string
          content_sha256?: string
          created_at?: string
          document_type?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          jurisdiction?: string
          language?: string
          published?: boolean
          title?: string
          version?: string
        }
        Relationships: []
      }
      llm_models: {
        Row: {
          capabilities: string[]
          context_tokens: number | null
          label: string
          latency: string
          long_context_threshold: number | null
          long_price_cached_in: number | null
          long_price_in: number | null
          long_price_out: number | null
          model: string
          notes: string
          price_cache_write: number | null
          price_cached_in: number | null
          price_in: number
          price_out: number
          prices_source_url: string
          prices_updated_at: string
          provider: string
          quality_prior: number | null
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          context_tokens?: number | null
          label: string
          latency?: string
          long_context_threshold?: number | null
          long_price_cached_in?: number | null
          long_price_in?: number | null
          long_price_out?: number | null
          model: string
          notes?: string
          price_cache_write?: number | null
          price_cached_in?: number | null
          price_in: number
          price_out: number
          prices_source_url: string
          prices_updated_at: string
          provider: string
          quality_prior?: number | null
          status?: string
          tier: string
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          context_tokens?: number | null
          label?: string
          latency?: string
          long_context_threshold?: number | null
          long_price_cached_in?: number | null
          long_price_in?: number | null
          long_price_out?: number | null
          model?: string
          notes?: string
          price_cache_write?: number | null
          price_cached_in?: number | null
          price_in?: number
          price_out?: number
          prices_source_url?: string
          prices_updated_at?: string
          provider?: string
          quality_prior?: number | null
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      mcp_calls: {
        Row: {
          connection_id: string
          created_at: string
          error_code: string | null
          id: number
          ok: boolean
          tool: string
          workspace_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          error_code?: string | null
          id?: never
          ok: boolean
          tool: string
          workspace_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          error_code?: string | null
          id?: never
          ok?: boolean
          tool?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_calls_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "mcp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_connections: {
        Row: {
          created_at: string
          id: string
          key_hash: string | null
          key_prefix: string | null
          kind: string
          last_used_at: string | null
          name: string
          oauth_client_id: string | null
          revoked_at: string | null
          scopes: string[]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash?: string | null
          key_prefix?: string | null
          kind: string
          last_used_at?: string | null
          name: string
          oauth_client_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string | null
          key_prefix?: string | null
          kind?: string
          last_used_at?: string | null
          name?: string
          oauth_client_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          created_by: string | null
          id: number
          model: string | null
          plan: Json | null
          role: string
          workspace_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: never
          model?: string | null
          plan?: Json | null
          role: string
          workspace_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: never
          model?: string | null
          plan?: Json | null
          role?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_workspace_id_fkey"
            columns: ["conversation_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          id: string
          provider: string
          redirect_uri: string
          state_hash: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at?: string
          id?: string
          provider: string
          redirect_uri: string
          state_hash: string
          user_id: string
          workspace_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          redirect_uri?: string
          state_hash?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_events: {
        Row: {
          created_at: string
          detail: Json
          id: number
          step: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: never
          step: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: never
          step?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          dedupe_key: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          published_at: string | null
          status: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          available_at?: string
          created_at?: string
          dedupe_key: string
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          published_at?: string | null
          status?: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          available_at?: string
          created_at?: string
          dedupe_key?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          published_at?: string | null
          status?: string
        }
        Relationships: []
      }
      page_versions: {
        Row: {
          content_md: string
          created_at: string
          edited_by: string | null
          flow_run_id: string | null
          id: number
          page_id: string
          workspace_id: string
        }
        Insert: {
          content_md: string
          created_at?: string
          edited_by?: string | null
          flow_run_id?: string | null
          id?: never
          page_id: string
          workspace_id: string
        }
        Update: {
          content_md?: string
          created_at?: string
          edited_by?: string | null
          flow_run_id?: string | null
          id?: never
          page_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_versions_flow_run_id_fkey"
            columns: ["flow_run_id"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          archived_at: string | null
          content_md: string
          created_at: string
          created_by: string | null
          flow_id: string | null
          id: string
          sections: Json
          slug: string
          source_ref: Json
          template: string | null
          title: string
          updated_at: string
          updated_by_run: string | null
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          content_md?: string
          created_at?: string
          created_by?: string | null
          flow_id?: string | null
          id?: string
          sections?: Json
          slug: string
          source_ref?: Json
          template?: string | null
          title: string
          updated_at?: string
          updated_by_run?: string | null
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          content_md?: string
          created_at?: string
          created_by?: string | null
          flow_id?: string | null
          id?: string
          sections?: Json
          slug?: string
          source_ref?: Json
          template?: string | null
          title?: string
          updated_at?: string
          updated_by_run?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_updated_by_run_fkey"
            columns: ["updated_by_run"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          attempts: number
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          processing_status: string
          provider: string
          provider_event_id: string
          received_at: string
          signature_valid: boolean
        }
        Insert: {
          attempts?: number
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider: string
          provider_event_id: string
          received_at?: string
          signature_valid?: boolean
        }
        Update: {
          attempts?: number
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_event_id?: string
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount_minor: number
          checkout_session_id: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          provider: string | null
          provider_payment_id: string | null
          status: string
          subscription_id: string | null
          succeeded_at: string | null
          workspace_id: string
        }
        Insert: {
          amount_minor: number
          checkout_session_id?: string | null
          created_at?: string
          currency: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          provider?: string | null
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
          succeeded_at?: string | null
          workspace_id: string
        }
        Update: {
          amount_minor?: number
          checkout_session_id?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          provider?: string | null
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string | null
          succeeded_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_checkout_session_id_workspace_id_fkey"
            columns: ["checkout_session_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "payment_transactions_subscription_id_workspace_id_fkey"
            columns: ["subscription_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "payment_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          active: boolean
          amount_minor: number
          created_at: string
          currency: string
          id: string
          interval_count: number
          interval_unit: string
          market_code: string
          plan_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          amount_minor: number
          created_at?: string
          currency: string
          id?: string
          interval_count?: number
          interval_unit: string
          market_code?: string
          plan_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          interval_count?: number
          interval_unit?: string
          market_code?: string
          plan_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
      }
      run_events: {
        Row: {
          created_at: string
          detail: Json | null
          id: number
          kind: string
          run_id: string
          title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          id?: never
          kind: string
          run_id: string
          title: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          id?: never
          kind?: string
          run_id?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_events_run_id_workspace_id_fkey"
            columns: ["run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_minor: number
          billing_customer_id: string
          cancel_at_period_end: boolean
          cancel_requested_at: string | null
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          id: string
          metadata: Json
          plan_id: string
          plan_price_id: string
          provider: string | null
          provider_subscription_id: string | null
          status: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount_minor: number
          billing_customer_id: string
          cancel_at_period_end?: boolean
          cancel_requested_at?: string | null
          canceled_at?: string | null
          created_at?: string
          currency: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          plan_id: string
          plan_price_id: string
          provider?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount_minor?: number
          billing_customer_id?: string
          cancel_at_period_end?: boolean
          cancel_requested_at?: string | null
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          plan_id?: string
          plan_price_id?: string
          provider?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_billing_customer_id_workspace_id_fkey"
            columns: ["billing_customer_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_price_id_fkey"
            columns: ["plan_price_id"]
            isOneToOne: false
            referencedRelation: "plan_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          audio_seconds: number
          cache_write_tokens: number
          cached_tokens: number
          conversation_id: string | null
          cost_usd: number
          created_at: string
          created_by: string | null
          funded_by: string
          id: number
          input_tokens: number
          kind: string
          latency_ms: number | null
          model: string
          output_tokens: number
          provider: string
          real_cost_usd: number
          reasoning_tokens: number
          run_id: string | null
          step_type: string
          task: string | null
          workspace_id: string
        }
        Insert: {
          audio_seconds?: number
          cache_write_tokens?: number
          cached_tokens?: number
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          funded_by?: string
          id?: never
          input_tokens?: number
          kind?: string
          latency_ms?: number | null
          model: string
          output_tokens?: number
          provider: string
          real_cost_usd?: number
          reasoning_tokens?: number
          run_id?: string | null
          step_type?: string
          task?: string | null
          workspace_id: string
        }
        Update: {
          audio_seconds?: number
          cache_write_tokens?: number
          cached_tokens?: number
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          funded_by?: string
          id?: never
          input_tokens?: number
          kind?: string
          latency_ms?: number | null
          model?: string
          output_tokens?: number
          provider?: string
          real_cost_usd?: number
          reasoning_tokens?: number
          run_id?: string | null
          step_type?: string
          task?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_conversation_id_workspace_id_fkey"
            columns: ["conversation_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "usage_events_run_id_workspace_id_fkey"
            columns: ["run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_channels: {
        Row: {
          link_code_expires: string | null
          link_code_hash: string | null
          notify_email: boolean
          notify_push: boolean
          notify_telegram: boolean
          telegram_chat_id: string | null
          telegram_chat_since: string | null
          telegram_name: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          link_code_expires?: string | null
          link_code_hash?: string | null
          notify_email?: boolean
          notify_push?: boolean
          notify_telegram?: boolean
          telegram_chat_id?: string | null
          telegram_chat_since?: string | null
          telegram_name?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          link_code_expires?: string | null
          link_code_hash?: string | null
          notify_email?: boolean
          notify_push?: boolean
          notify_telegram?: boolean
          telegram_chat_id?: string | null
          telegram_chat_since?: string | null
          telegram_name?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_web_sessions: {
        Row: {
          ended_at: string | null
          id: string
          origin: string | null
          secret_hash: string
          started_at: string
          tool_calls: number
          visitor_hash: string
          workspace_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          origin?: string | null
          secret_hash: string
          started_at?: string
          tool_calls?: number
          visitor_hash: string
          workspace_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          origin?: string | null
          secret_hash?: string
          started_at?: string
          tool_calls?: number
          visitor_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_web_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_web_widgets: {
        Row: {
          allowed_domains: string[]
          created_at: string
          enabled: boolean
          minutes_per_session: number
          public_id: string
          sessions_per_day: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allowed_domains?: string[]
          created_at?: string
          enabled?: boolean
          minutes_per_session?: number
          public_id: string
          sessions_per_day?: number
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allowed_domains?: string[]
          created_at?: string
          enabled?: boolean
          minutes_per_session?: number
          public_id?: string
          sessions_per_day?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_web_widgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_trial_credits: {
        Row: {
          allowance_plans: number
          allowance_runs: number
          allowance_tokens: number
          allowance_usd: number
          created_at: string
          expires_at: string
          reserved_run_id: string | null
          updated_at: string
          used_plans: number
          used_runs: number
          used_tokens: number
          used_usd: number
          workspace_id: string
        }
        Insert: {
          allowance_plans?: number
          allowance_runs?: number
          allowance_tokens?: number
          allowance_usd?: number
          created_at?: string
          expires_at?: string
          reserved_run_id?: string | null
          updated_at?: string
          used_plans?: number
          used_runs?: number
          used_tokens?: number
          used_usd?: number
          workspace_id: string
        }
        Update: {
          allowance_plans?: number
          allowance_runs?: number
          allowance_tokens?: number
          allowance_usd?: number
          created_at?: string
          expires_at?: string
          reserved_run_id?: string | null
          updated_at?: string
          used_plans?: number
          used_runs?: number
          used_tokens?: number
          used_usd?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_trial_credits_reserved_run_id_fkey"
            columns: ["reserved_run_id"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_trial_credits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          ai_routing: Json
          created_at: string
          created_by: string | null
          help_voice_enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          onboarding_completed_at: string | null
          personal_owner: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          ai_routing?: Json
          created_at?: string
          created_by?: string | null
          help_voice_enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          onboarding_completed_at?: string | null
          personal_owner?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          ai_routing?: Json
          created_at?: string
          created_by?: string | null
          help_voice_enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["workspace_kind"]
          name?: string
          onboarding_completed_at?: string | null
          personal_owner?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      ai_connection_delete: {
        Args: { p_actor: string; p_provider: string; p_workspace_id: string }
        Returns: boolean
      }
      ai_connection_mark_invalid: {
        Args: { p_provider: string; p_workspace_id: string }
        Returns: undefined
      }
      ai_connection_save: {
        Args: {
          p_actor: string
          p_api_key: string
          p_model: string
          p_provider: string
          p_workspace_id: string
        }
        Returns: {
          connection_id: string
          key_hint: string
          model: string
        }[]
      }
      ai_connection_secret: {
        Args: { p_provider: string; p_workspace_id: string }
        Returns: {
          api_key: string
          model: string
          status: string
        }[]
      }
      ai_connection_set_default: {
        Args: { p_provider: string; p_workspace_id: string }
        Returns: boolean
      }
      ai_spend: {
        Args: { p_workspace_id: string }
        Returns: {
          day_usd: number
          month_usd: number
        }[]
      }
      ai_spend_breakdown: {
        Args: { p_since: string; p_workspace_id: string }
        Returns: {
          calls: number
          cost_usd: number
          input_tokens: number
          model: string
          output_tokens: number
          task: string
        }[]
      }
      create_invitation: {
        Args: {
          p_email: string
          p_role?: Database["public"]["Enums"]["workspace_role"]
          p_workspace_id: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      create_organization: { Args: { p_name: string }; Returns: string }
      cron_secret: { Args: never; Returns: string }
      flow_run_add_cost: {
        Args: { p_cost: number; p_run_id: string }
        Returns: number
      }
      flows_due: {
        Args: { p_limit?: number }
        Returns: {
          created_by: string
          definition: Json
          id: string
          launch: boolean
          name: string
          scheduled_for: string
          settings: Json
          workspace_id: string
        }[]
      }
      inbox_purge: {
        Args: { p_days: number; p_workspace_id: string }
        Returns: number
      }
      inbox_record_message: {
        Args: {
          p_body: string
          p_channel: string
          p_contact_address: string
          p_contact_name: string
          p_direction: string
          p_external_id: string
          p_integration_id: string
          p_recipients: string
          p_run_id?: string
          p_sender_address: string
          p_sender_name: string
          p_sent_at: string
          p_subject: string
          p_thread_external_id: string
          p_workspace_id: string
        }
        Returns: number
      }
      inbox_workspaces_pending: {
        Args: { p_limit: number }
        Returns: {
          pending: number
          workspace_id: string
        }[]
      }
      integration_delete: {
        Args: { p_actor: string; p_provider: string; p_workspace_id: string }
        Returns: boolean
      }
      integration_mark_invalid: {
        Args: { p_provider: string; p_workspace_id: string }
        Returns: undefined
      }
      integration_save: {
        Args: {
          p_account_email: string
          p_actor: string
          p_provider: string
          p_refresh_token: string
          p_scopes: string
          p_workspace_id: string
        }
        Returns: string
      }
      integration_secret: {
        Args: { p_provider: string; p_workspace_id: string }
        Returns: {
          account_email: string
          integration_id: string
          refresh_token: string
          status: string
        }[]
      }
      integration_secret_by_id: {
        Args: { p_integration_id: string }
        Returns: {
          config: Json
          provider: string
          secret: string
          status: string
          workspace_id: string
        }[]
      }
      integration_set_config: {
        Args: { p_config: Json; p_provider: string; p_workspace_id: string }
        Returns: undefined
      }
      mail_integrations_due: {
        Args: { p_limit?: number }
        Returns: {
          provider: string
          workspace_id: string
        }[]
      }
      mcp_calls_purge: { Args: never; Returns: number }
      mcp_check_rate: { Args: { p_connection_id: string }; Returns: string }
      mcp_connection_revoke: { Args: { p_id: string }; Returns: string }
      mcp_draft_usage: {
        Args: { p_workspace_id: string }
        Returns: {
          max_pending: number
          max_today: number
          pending: number
          today: number
        }[]
      }
      mcp_key_create: {
        Args: { p_name: string; p_scopes: string[]; p_workspace_id: string }
        Returns: {
          api_key: string
          id: string
        }[]
      }
      mcp_oauth_connect: {
        Args: {
          p_client_id: string
          p_name: string
          p_scopes: string[]
          p_workspace_id: string
        }
        Returns: string
      }
      mcp_resolve: {
        Args: { p_client_id: string; p_key_hash: string; p_user_id: string }
        Returns: {
          id: string
          kind: string
          name: string
          scopes: string[]
          user_id: string
          workspace_id: string
        }[]
      }
      notice_prefs_set: {
        Args: {
          p_email: boolean
          p_push: boolean
          p_telegram: boolean
          p_workspace_id: string
        }
        Returns: undefined
      }
      onboarding_track: {
        Args: { p_detail?: Json; p_step: string; p_workspace_id: string }
        Returns: undefined
      }
      push_subscribe: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent: string
        }
        Returns: string
      }
      telegram_link_complete: {
        Args: {
          p_chat_id: string
          p_code: string
          p_name: string
          p_workspace_id: string
        }
        Returns: string
      }
      telegram_link_start: { Args: { p_workspace_id: string }; Returns: string }
      telegram_unlink: { Args: { p_workspace_id: string }; Returns: undefined }
      trial_add_cost: {
        Args: { p_cost: number; p_workspace_id: string }
        Returns: number
      }
      trial_consume: {
        Args: { p_tokens: number; p_workspace_id: string }
        Returns: number
      }
      trial_run_commit: {
        Args: { p_run_id: string; p_workspace_id: string }
        Returns: boolean
      }
      trial_run_consume: {
        Args: { p_run_id: string; p_workspace_id: string }
        Returns: boolean
      }
      trial_run_release: {
        Args: { p_run_id: string; p_workspace_id: string }
        Returns: boolean
      }
      workspace_complete_onboarding: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      workspace_set_ai_routing: {
        Args: { p_settings: Json; p_workspace_id: string }
        Returns: boolean
      }
      workspace_set_help_voice: {
        Args: { p_enabled: boolean; p_workspace_id: string }
        Returns: boolean
      }
      workspace_set_timezone: {
        Args: { p_timezone: string | null; p_workspace_id: string }
        Returns: string
      }
    }
    Enums: {
      membership_status: "active" | "suspended"
      workspace_kind: "personal" | "organization"
      workspace_role: "owner" | "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      membership_status: ["active", "suspended"],
      workspace_kind: ["personal", "organization"],
      workspace_role: ["owner", "admin", "member"],
    },
  },
} as const
