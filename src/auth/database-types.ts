import type { JsonValue } from "../core/content-schema";

// Kept in sync with the checked-in SQL migration; regenerate from the dedicated project when linked.
export type Database = {
  public: {
    Tables: {
      devmap_profiles: {
        Row: { user_id: string; display_name: string; updated_at: string };
        Insert: { user_id: string; display_name: string; updated_at?: string };
        Update: { display_name?: string; updated_at?: string };
        Relationships: [];
      };
      devmap_workspaces: {
        Row: {
          user_id: string;
          revision: number;
          payload: JsonValue;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          revision: number;
          payload: JsonValue;
          updated_at?: string;
        };
        Update: { revision?: number; payload?: JsonValue; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      devmap_save_workspace: {
        Args: {
          expected_user_id: string;
          expected_revision: number;
          new_payload: JsonValue;
        };
        Returns: { new_revision: number; saved_at: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
