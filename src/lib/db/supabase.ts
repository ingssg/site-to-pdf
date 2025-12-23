/**
 * Supabase 클라이언트 설정
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Database features will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Database 테이블 타입 정의 (나중에 Supabase에서 자동 생성 가능)
 */
export type Database = {
  public: {
    Tables: {
      crawl_jobs: {
        Row: {
          id: string;
          user_id: string | null;
          url: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          config: any;
          result: any | null;
          error: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          url: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          config: any;
          result?: any | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          url?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          config?: any;
          result?: any | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          plan: 'free' | 'pro' | 'business' | 'enterprise';
          monthly_limit: number;
          used_this_month: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          plan?: 'free' | 'pro' | 'business' | 'enterprise';
          monthly_limit?: number;
          used_this_month?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          plan?: 'free' | 'pro' | 'business' | 'enterprise';
          monthly_limit?: number;
          used_this_month?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
