
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
            "daily_prompts": {
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
                    "created_at": string,"entry_number": number | null,"id": string,"just_listen": boolean,"local_date": string,"prompt_id": number | null,"status": Database["public"]['Enums']["entry_status"],"updated_at": string,"user_id": string,"word_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entry_number"?: number | null,"id"?: string,"just_listen"?: boolean,"local_date"?: string,"prompt_id"?: number | null,"status"?: Database["public"]['Enums']["entry_status"],"updated_at"?: string,"user_id"?: string,"word_count"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"entry_number"?: number | null,"id"?: string,"just_listen"?: boolean,"local_date"?: string,"prompt_id"?: number | null,"status"?: Database["public"]['Enums']["entry_status"],"updated_at"?: string,"user_id"?: string,"word_count"?: number | null
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
"shuffle_today_prompt":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": number,"text": string
            }[]
                           },
"user_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            "entry_status": "uploading"|"uploaded"|"processing"|"ready"|"failed","persona": "cheerleader"|"professor"|"friend"
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
            "entry_status": ["uploading", "uploaded", "processing", "ready", "failed"],"persona": ["cheerleader", "professor", "friend"]
          }
        }
} as const
