/**
 * Supabase 클라이언트 설정
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 빌드 시 환경 변수가 없을 수 있으므로 기본값 제공
const safeSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeSupabaseAnonKey = supabaseAnonKey || 'placeholder-key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Database features will be disabled.');
}

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey);

/**
 * Database 테이블 타입 정의
 */
export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string;
          user_id: string | null;
          status: 'pending' | 'crawling' | 'summarizing' | 'generating_pdf' | 'completed' | 'failed';
          config: {
            url: string;
            maxPages: number;
            crawlMode: 'full' | 'smart';
          };
          progress: {
            current: number;
            total: number;
            message: string;
            percentage: number;
          } | null;
          result: {
            zipUrl?: string;
            screenshotUrl?: string;
            summary?: any;
            crawlResult?: any;
          } | null;
          error: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          status?: 'pending' | 'crawling' | 'summarizing' | 'generating_pdf' | 'completed' | 'failed';
          config: {
            url: string;
            maxPages: number;
            crawlMode: 'full' | 'smart';
          };
          progress?: {
            current: number;
            total: number;
            message: string;
            percentage: number;
          } | null;
          result?: any | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          status?: 'pending' | 'crawling' | 'summarizing' | 'generating_pdf' | 'completed' | 'failed';
          config?: {
            url: string;
            maxPages: number;
            crawlMode: 'full' | 'smart';
          };
          progress?: {
            current: number;
            total: number;
            message: string;
            percentage: number;
          } | null;
          result?: any | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
      };
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
