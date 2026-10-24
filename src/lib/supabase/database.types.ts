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
      ai_connections: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
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
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          email: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          email: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          email?: string
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
          trigger: Json
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
          source_message_id: number | null
          started_at: string
          started_by: string | null
          state: Json
          status: string
          summary: string | null
          tool_calls: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          trigger?: Json
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
          source_message_id?: number | null
          started_at?: string
          started_by?: string | null
          state?: Json
          status?: string
          summary?: string | null
          tool_calls?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          trigger?: Json
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
          source_message_id?: number | null
          started_at?: string
          started_by?: string | null
          state?: Json
          status?: string
          summary?: string | null
          tool_calls?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_runs_source_message_fkey"
            columns: ["source_message_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "flow_runs_flow_id_workspace_id_fkey"
            columns: ["flow_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "flows"
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
          settings: Json
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          name: string
          source_message_id: number | null
          status: string
          summary: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          settings?: Json
          created_at?: string
          created_by?: string | null
          definition: Json
          id?: string
          name: string
          source_message_id?: number | null
          status?: string
          summary?: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          settings?: Json
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          name?: string
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
        Relationships: []
      }
      inbox_threads: {
        Row: {
          archived: boolean
          category: string | null
          channel: string
          classified_at: string | null
          classified_count: number
          client: string | null
          contact_address: string | null
          contact_name: string | null
          created_at: string
          external_id: string
          id: string
          integration_id: string | null
          last_message_at: string | null
          manually_edited: boolean
          message_count: number
          needs_reply: boolean | null
          project: string | null
          subject: string | null
          summary: string | null
          updated_at: string
          urgency: string | null
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          category?: string | null
          channel: string
          classified_at?: string | null
          classified_count?: number
          client?: string | null
          contact_address?: string | null
          contact_name?: string | null
          created_at?: string
          external_id: string
          id?: string
          integration_id?: string | null
          last_message_at?: string | null
          manually_edited?: boolean
          message_count?: number
          needs_reply?: boolean | null
          project?: string | null
          subject?: string | null
          summary?: string | null
          updated_at?: string
          urgency?: string | null
          workspace_id: string
        }
        Update: {
          archived?: boolean
          category?: string | null
          channel?: string
          classified_at?: string | null
          classified_count?: number
          client?: string | null
          contact_address?: string | null
          contact_name?: string | null
          created_at?: string
          external_id?: string
          id?: string
          integration_id?: string | null
          last_message_at?: string | null
          manually_edited?: boolean
          message_count?: number
          needs_reply?: boolean | null
          project?: string | null
          subject?: string | null
          summary?: string | null
          updated_at?: string
          urgency?: string | null
          workspace_id?: string
        }
        Relationships: []
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
          config: Json
          account_email: string | null
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
          config?: Json
          account_email?: string | null
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
          config?: Json
          account_email?: string | null
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
      usage_events: {
        Row: {
          audio_seconds: number
          conversation_id: string | null
          created_at: string
          created_by: string | null
          id: number
          input_tokens: number
          kind: string
          model: string
          output_tokens: number
          provider: string
          workspace_id: string
        }
        Insert: {
          audio_seconds?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          input_tokens?: number
          kind?: string
          model: string
          output_tokens?: number
          provider: string
          workspace_id: string
        }
        Update: {
          audio_seconds?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          input_tokens?: number
          kind?: string
          model?: string
          output_tokens?: number
          provider?: string
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
            foreignKeyName: "usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          personal_owner: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          personal_owner?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["workspace_kind"]
          name?: string
          personal_owner?: string | null
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
      integration_secret: {
        Args: { p_provider: string; p_workspace_id: string }
        Returns: {
          account_email: string
          integration_id: string
          refresh_token: string
          status: string
        }[]
      }
      mail_integrations_due: {
        Args: { p_limit?: number }
        Returns: { provider: string; workspace_id: string }[]
      }
      push_subscribe: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_user_agent: string }
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
