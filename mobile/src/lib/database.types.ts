
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "coach_runs": {
                  Row: {
                    "cost_usd": number | null,"created_at": string,"entry_id": string | null,"error": string | null,"id": number,"input_tokens": number | null,"latency_ms": number | null,"local_date": string,"model": string,"ok": boolean | null,"output_tokens": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_usd"?: number | null,"created_at"?: string,"entry_id"?: string | null,"error"?: string | null,"id"?: never,"input_tokens"?: number | null,"latency_ms"?: number | null,"local_date": string,"model": string,"ok"?: boolean | null,"output_tokens"?: number | null,"user_id": string
                  }
                  Update: {
                    "cost_usd"?: number | null,"created_at"?: string,"entry_id"?: string | null,"error"?: string | null,"id"?: never,"input_tokens"?: number | null,"latency_ms"?: number | null,"local_date"?: string,"model"?: string,"ok"?: boolean | null,"output_tokens"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coach_runs_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"crutch_uses": {
                  Row: {
                    "alternatives": (string)[],"count": number,"created_at": string,"entry_id": string,"id": number,"user_id": string,"word": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alternatives"?: (string)[],"count": number,"created_at"?: string,"entry_id": string,"id"?: never,"user_id": string,"word": string
                  }
                  Update: {
                    "alternatives"?: (string)[],"count"?: number,"created_at"?: string,"entry_id"?: string,"id"?: never,"user_id"?: string,"word"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crutch_uses_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_prompts": {
                  Row: {
                    "local_date": string,"prompt_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "local_date": string,"prompt_id": number,"user_id": string
                  }
                  Update: {
                    "local_date"?: string,"prompt_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_prompts_prompt_id_fkey"
      columns: ["prompt_id"]
isOneToOne: false
      referencedRelation: "prompts"
      referencedColumns: ["id"]
    }
                  ]
                },"entries": {
                  Row: {
                    "avg_sentence_len": number | null,"coach_error": string | null,"coach_model": string | null,"coach_persona": Database["public"]['Enums']["persona"] | null,"coach_reply": string | null,"correct_patterns": (string)[],"corrections": NonNullable<Json>,"created_at": string,"entry_number": number | null,"heavy": boolean,"id": string,"just_listen": boolean,"local_date": string,"mood": Database["public"]['Enums']["mood"] | null,"native_score": number | null,"native_version": string | null,"processed_at": string | null,"prompt_id": number | null,"safety_flag": boolean,"saved_at": string | null,"score_delta": number | null,"score_version": number | null,"search": unknown,"status": Database["public"]['Enums']["entry_status"],"transcript": string | null,"uncertain_words": (string)[],"updated_at": string,"user_id": string,"word_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_sentence_len"?: number | null,"coach_error"?: string | null,"coach_model"?: string | null,"coach_persona"?: Database["public"]['Enums']["persona"] | null,"coach_reply"?: string | null,"correct_patterns"?: (string)[],"corrections"?: NonNullable<Json>,"created_at"?: string,"entry_number"?: number | null,"heavy"?: boolean,"id"?: string,"just_listen"?: boolean,"local_date"?: string,"mood"?: Database["public"]['Enums']["mood"] | null,"native_score"?: number | null,"native_version"?: string | null,"processed_at"?: string | null,"prompt_id"?: number | null,"safety_flag"?: boolean,"saved_at"?: string | null,"score_delta"?: number | null,"score_version"?: number | null,"search"?: never,"status"?: Database["public"]['Enums']["entry_status"],"transcript"?: string | null,"uncertain_words"?: (string)[],"updated_at"?: string,"user_id"?: string,"word_count"?: number | null
                  }
                  Update: {
                    "avg_sentence_len"?: number | null,"coach_error"?: string | null,"coach_model"?: string | null,"coach_persona"?: Database["public"]['Enums']["persona"] | null,"coach_reply"?: string | null,"correct_patterns"?: (string)[],"corrections"?: NonNullable<Json>,"created_at"?: string,"entry_number"?: number | null,"heavy"?: boolean,"id"?: string,"just_listen"?: boolean,"local_date"?: string,"mood"?: Database["public"]['Enums']["mood"] | null,"native_score"?: number | null,"native_version"?: string | null,"processed_at"?: string | null,"prompt_id"?: number | null,"safety_flag"?: boolean,"saved_at"?: string | null,"score_delta"?: number | null,"score_version"?: number | null,"search"?: never,"status"?: Database["public"]['Enums']["entry_status"],"transcript"?: string | null,"uncertain_words"?: (string)[],"updated_at"?: string,"user_id"?: string,"word_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "entries_prompt_id_fkey"
      columns: ["prompt_id"]
isOneToOne: false
      referencedRelation: "prompts"
      referencedColumns: ["id"]
    }
                  ]
                },"entry_pages": {
                  Row: {
                    "created_at": string,"entry_id": string,"page_index": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entry_id": string,"page_index": number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"entry_id"?: string,"page_index"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entry_pages_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"error_types": {
                  Row: {
                    "name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"slug": string
                  }
                  Update: {
                    "name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mistakes": {
                  Row: {
                    "corrected": string,"created_at": string,"entry_id": string,"error_type": string,"id": number,"original": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "corrected": string,"created_at"?: string,"entry_id": string,"error_type": string,"id"?: never,"original": string,"user_id": string
                  }
                  Update: {
                    "corrected"?: string,"created_at"?: string,"entry_id"?: string,"error_type"?: string,"id"?: never,"original"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mistakes_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mistakes_error_type_fkey"
      columns: ["error_type"]
isOneToOne: false
      referencedRelation: "error_types"
      referencedColumns: ["slug"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"expo_push_token": string | null,"id": string,"learning_goal": string,"native_language": string,"nudge_time": string,"offer_just_listen": boolean,"persona": Database["public"]['Enums']["persona"],"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"expo_push_token"?: string | null,"id": string,"learning_goal": string,"native_language": string,"nudge_time"?: string,"offer_just_listen"?: boolean,"persona"?: Database["public"]['Enums']["persona"],"timezone": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"expo_push_token"?: string | null,"id"?: string,"learning_goal"?: string,"native_language"?: string,"nudge_time"?: string,"offer_just_listen"?: boolean,"persona"?: Database["public"]['Enums']["persona"],"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"prompts": {
                  Row: {
                    "id": number,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"text": string
                  }
                  Update: {
                    "id"?: never,"text"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "coach_claim":
{ Args: { "p_entry_id": string,"p_model": string,"p_user_id": string }; Returns: {
              "just_listen": boolean,"run_id": number
            }[]
                           },
"coach_context":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"coach_error_history":
{ Args: { "p_slugs": (string)[],"p_user_id": string }; Returns: {
              "slug": string,"this_week": number,"total": number
            }[]
                           },
"coach_fail":
{ Args: { "p_entry_id": string,"p_error": string,"p_run_id": number }; Returns: undefined
                           },
"coach_save":
{ Args: { "p_entry_id": string,"p_result": Json,"p_run_id": number,"p_usage": Json }; Returns: undefined
                           },
"complete_entry_upload":
{ Args: { "p_entry_id": string }; Returns: undefined
                           },
"get_profile_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "entry_count": number,"page_count": number,"word_count": number
            }[]
                           },
"get_streak":
{ Args: Record<PropertyKey, never>; Returns: {
              "days": number,"today": string,"week": (string)[],"written_today": boolean
            }[]
                           },
"get_today_prompt":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": number,"text": string
            }[]
                           },
"is_valid_timezone":
{ Args: { "tz": string }; Returns: boolean
                           },
"journal_date":
{ Args: { "at": string,"tz": string }; Returns: string
                           },
"pick_prompt":
{ Args: { "not_this": number,"uid": string }; Returns: number
                           },
"save_entry_to_vault":
{ Args: { "p_entry_id": string }; Returns: undefined
                           },
"shuffle_today_prompt":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": number,"text": string
            }[]
                           },
"switch_to_just_listen":
{ Args: { "p_entry_id": string }; Returns: undefined
                           },
"user_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            "entry_status": "uploading"|"uploaded"|"processing"|"ready"|"failed","mood": "happy"|"grateful"|"calm"|"stressed","persona": "cheerleader"|"professor"|"friend"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "entry_status": ["uploading", "uploaded", "processing", "ready", "failed"],"mood": ["happy", "grateful", "calm", "stressed"],"persona": ["cheerleader", "professor", "friend"]
          }
        }
} as const
