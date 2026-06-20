export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      chore_completions: {
        Row: {
          awarded_points: number | null;
          chore_instance_id: string;
          claimed_at: string | null;
          created_at: string;
          family_id: string;
          id: string;
          kid_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database['public']['Enums']['completion_status'];
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          awarded_points?: number | null;
          chore_instance_id: string;
          claimed_at?: string | null;
          created_at?: string;
          family_id: string;
          id?: string;
          kid_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['completion_status'];
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          awarded_points?: number | null;
          chore_instance_id?: string;
          claimed_at?: string | null;
          created_at?: string;
          family_id?: string;
          id?: string;
          kid_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['completion_status'];
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chore_completions_chore_instance_id_fkey';
            columns: ['chore_instance_id'];
            isOneToOne: false;
            referencedRelation: 'chore_instances';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chore_completions_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chore_completions_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chore_completions_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      chore_instances: {
        Row: {
          chore_id: string;
          created_at: string;
          due_date: string;
          family_id: string;
          id: string;
          points: number;
          updated_at: string;
        };
        Insert: {
          chore_id: string;
          created_at?: string;
          due_date: string;
          family_id: string;
          id?: string;
          points: number;
          updated_at?: string;
        };
        Update: {
          chore_id?: string;
          created_at?: string;
          due_date?: string;
          family_id?: string;
          id?: string;
          points?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chore_instances_chore_id_fkey';
            columns: ['chore_id'];
            isOneToOne: false;
            referencedRelation: 'chores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chore_instances_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      chores: {
        Row: {
          active: boolean;
          assigned_kid_id: string | null;
          assignment: Database['public']['Enums']['chore_assignment'];
          created_at: string;
          family_id: string;
          icon: string | null;
          id: string;
          points: number;
          recurrence_rule: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          assigned_kid_id?: string | null;
          assignment?: Database['public']['Enums']['chore_assignment'];
          created_at?: string;
          family_id: string;
          icon?: string | null;
          id?: string;
          points: number;
          recurrence_rule?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          assigned_kid_id?: string | null;
          assignment?: Database['public']['Enums']['chore_assignment'];
          created_at?: string;
          family_id?: string;
          icon?: string | null;
          id?: string;
          points?: number;
          recurrence_rule?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chores_assigned_kid_id_fkey';
            columns: ['assigned_kid_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chores_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      families: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      point_transactions: {
        Row: {
          amount: number;
          awarded_by: string | null;
          chore_completion_id: string | null;
          created_at: string;
          family_id: string;
          id: string;
          kid_id: string;
          note: string | null;
          type: Database['public']['Enums']['point_txn_type'];
        };
        Insert: {
          amount: number;
          awarded_by?: string | null;
          chore_completion_id?: string | null;
          created_at?: string;
          family_id: string;
          id?: string;
          kid_id: string;
          note?: string | null;
          type: Database['public']['Enums']['point_txn_type'];
        };
        Update: {
          amount?: number;
          awarded_by?: string | null;
          chore_completion_id?: string | null;
          created_at?: string;
          family_id?: string;
          id?: string;
          kid_id?: string;
          note?: string | null;
          type?: Database['public']['Enums']['point_txn_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'point_transactions_awarded_by_fkey';
            columns: ['awarded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'point_transactions_chore_completion_id_fkey';
            columns: ['chore_completion_id'];
            isOneToOne: false;
            referencedRelation: 'chore_completions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'point_transactions_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'point_transactions_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          age_mode: Database['public']['Enums']['age_mode'] | null;
          auth_user_id: string | null;
          avatar_url: string | null;
          birthdate: string | null;
          created_at: string;
          display_name: string;
          family_id: string;
          id: string;
          pin_hash: string | null;
          role: Database['public']['Enums']['profile_role'];
          updated_at: string;
        };
        Insert: {
          age_mode?: Database['public']['Enums']['age_mode'] | null;
          auth_user_id?: string | null;
          avatar_url?: string | null;
          birthdate?: string | null;
          created_at?: string;
          display_name: string;
          family_id: string;
          id?: string;
          pin_hash?: string | null;
          role: Database['public']['Enums']['profile_role'];
          updated_at?: string;
        };
        Update: {
          age_mode?: Database['public']['Enums']['age_mode'] | null;
          auth_user_id?: string | null;
          avatar_url?: string | null;
          birthdate?: string | null;
          created_at?: string;
          display_name?: string;
          family_id?: string;
          id?: string;
          pin_hash?: string | null;
          role?: Database['public']['Enums']['profile_role'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      reading_logs: {
        Row: {
          awarded_points: number | null;
          book_title: string;
          created_at: string;
          family_id: string;
          id: string;
          kid_id: string;
          minutes: number;
          read_on: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database['public']['Enums']['reading_status'];
          updated_at: string;
        };
        Insert: {
          awarded_points?: number | null;
          book_title: string;
          created_at?: string;
          family_id: string;
          id?: string;
          kid_id: string;
          minutes: number;
          read_on?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['reading_status'];
          updated_at?: string;
        };
        Update: {
          awarded_points?: number | null;
          book_title?: string;
          created_at?: string;
          family_id?: string;
          id?: string;
          kid_id?: string;
          minutes?: number;
          read_on?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['reading_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reading_logs_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reading_logs_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reading_logs_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reading_streaks: {
        Row: {
          created_at: string;
          current_streak: number;
          family_id: string;
          id: string;
          kid_id: string;
          last_read_date: string | null;
          longest_streak: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_streak?: number;
          family_id: string;
          id?: string;
          kid_id: string;
          last_read_date?: string | null;
          longest_streak?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_streak?: number;
          family_id?: string;
          id?: string;
          kid_id?: string;
          last_read_date?: string | null;
          longest_streak?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reading_streaks_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reading_streaks_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reward_purchases: {
        Row: {
          cost: number;
          created_at: string;
          family_id: string;
          given_at: string | null;
          given_by: string | null;
          id: string;
          kid_id: string;
          point_transaction_id: string | null;
          purchased_at: string;
          reward_id: string;
          status: Database['public']['Enums']['purchase_status'];
          updated_at: string;
        };
        Insert: {
          cost: number;
          created_at?: string;
          family_id: string;
          given_at?: string | null;
          given_by?: string | null;
          id?: string;
          kid_id: string;
          point_transaction_id?: string | null;
          purchased_at?: string;
          reward_id: string;
          status?: Database['public']['Enums']['purchase_status'];
          updated_at?: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          family_id?: string;
          given_at?: string | null;
          given_by?: string | null;
          id?: string;
          kid_id?: string;
          point_transaction_id?: string | null;
          purchased_at?: string;
          reward_id?: string;
          status?: Database['public']['Enums']['purchase_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reward_purchases_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_purchases_given_by_fkey';
            columns: ['given_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_purchases_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_purchases_point_transaction_id_fkey';
            columns: ['point_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'point_transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_purchases_reward_id_fkey';
            columns: ['reward_id'];
            isOneToOne: false;
            referencedRelation: 'rewards';
            referencedColumns: ['id'];
          },
        ];
      };
      rewards: {
        Row: {
          active: boolean;
          cost: number;
          created_at: string;
          emoji: string | null;
          family_id: string;
          id: string;
          image_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          cost: number;
          created_at?: string;
          emoji?: string | null;
          family_id: string;
          id?: string;
          image_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          cost?: number;
          created_at?: string;
          emoji?: string | null;
          family_id?: string;
          id?: string;
          image_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rewards_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      savings_goals: {
        Row: {
          achieved_at: string | null;
          active: boolean;
          created_at: string;
          emoji: string | null;
          family_id: string;
          id: string;
          kid_id: string;
          target: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          achieved_at?: string | null;
          active?: boolean;
          created_at?: string;
          emoji?: string | null;
          family_id: string;
          id?: string;
          kid_id: string;
          target: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          achieved_at?: string | null;
          active?: boolean;
          created_at?: string;
          emoji?: string | null;
          family_id?: string;
          id?: string;
          kid_id?: string;
          target?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'savings_goals_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'savings_goals_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      savings_transactions: {
        Row: {
          amount: number;
          created_at: string;
          family_id: string;
          id: string;
          kid_id: string;
          note: string | null;
          type: Database['public']['Enums']['savings_txn_type'];
        };
        Insert: {
          amount: number;
          created_at?: string;
          family_id: string;
          id?: string;
          kid_id: string;
          note?: string | null;
          type: Database['public']['Enums']['savings_txn_type'];
        };
        Update: {
          amount?: number;
          created_at?: string;
          family_id?: string;
          id?: string;
          kid_id?: string;
          note?: string | null;
          type?: Database['public']['Enums']['savings_txn_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'savings_transactions_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'savings_transactions_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      schedule_items: {
        Row: {
          active: boolean;
          created_at: string;
          days_of_week: number[];
          end_time: string | null;
          family_id: string;
          icon: string | null;
          id: string;
          kid_id: string;
          start_time: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          days_of_week?: number[];
          end_time?: string | null;
          family_id: string;
          icon?: string | null;
          id?: string;
          kid_id: string;
          start_time: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          days_of_week?: number[];
          end_time?: string | null;
          family_id?: string;
          icon?: string | null;
          id?: string;
          kid_id?: string;
          start_time?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedule_items_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'schedule_items_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      wallets: {
        Row: {
          created_at: string;
          family_id: string;
          id: string;
          kid_id: string;
          savings_balance: number;
          updated_at: string;
          wallet_balance: number;
        };
        Insert: {
          created_at?: string;
          family_id: string;
          id?: string;
          kid_id: string;
          savings_balance?: number;
          updated_at?: string;
          wallet_balance?: number;
        };
        Update: {
          created_at?: string;
          family_id?: string;
          id?: string;
          kid_id?: string;
          savings_balance?: number;
          updated_at?: string;
          wallet_balance?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'wallets_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallets_kid_id_fkey';
            columns: ['kid_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      age_mode: 'simple' | 'detailed' | 'teen';
      chore_assignment: 'assigned' | 'shared';
      completion_status: 'claimed' | 'pending' | 'approved' | 'rejected';
      point_txn_type: 'earn' | 'bonus' | 'spend' | 'refund';
      profile_role: 'parent' | 'kid';
      purchase_status: 'purchased' | 'given';
      reading_status: 'pending' | 'approved' | 'rejected';
      savings_txn_type: 'deposit' | 'withdraw' | 'interest';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      age_mode: ['simple', 'detailed', 'teen'],
      chore_assignment: ['assigned', 'shared'],
      completion_status: ['claimed', 'pending', 'approved', 'rejected'],
      point_txn_type: ['earn', 'bonus', 'spend', 'refund'],
      profile_role: ['parent', 'kid'],
      purchase_status: ['purchased', 'given'],
      reading_status: ['pending', 'approved', 'rejected'],
      savings_txn_type: ['deposit', 'withdraw', 'interest'],
    },
  },
} as const;
