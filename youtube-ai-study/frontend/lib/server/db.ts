import { createClient } from "@supabase/supabase-js";
import { readRequired } from "./env";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_user_id: string;
          email: string;
          plan: "free" | "pro";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          email: string;
          plan?: "free" | "pro";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          clerk_user_id?: string;
          email?: string;
          plan?: "free" | "pro";
          updated_at?: string;
        };
        Relationships: [];
      };
      videos: {
        Row: {
          id: string;
          user_id: string;
          youtube_url: string;
          title: string;
          thumbnail: string;
          source_video_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          youtube_url: string;
          title: string;
          thumbnail: string;
          source_video_id?: string;
          created_at?: string;
        };
        Update: {
          youtube_url?: string;
          title?: string;
          thumbnail?: string;
          source_video_id?: string;
        };
        Relationships: [];
      };
      video_content: {
        Row: {
          id: string;
          video_id: string;
          transcript: string;
          summary: string;
          notes: Json;
          chapters: Json;
          quiz: Json;
          pdf_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          transcript: string;
          summary: string;
          notes: Json;
          chapters: Json;
          quiz: Json;
          pdf_url: string | null;
          created_at?: string;
        };
        Update: {
          transcript?: string;
          summary?: string;
          notes?: Json;
          chapters?: Json;
          quiz?: Json;
          pdf_url?: string | null;
        };
        Relationships: [];
      };
      library: {
        Row: {
          id: string;
          user_id: string;
          video_id: string;
          saved_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          video_id: string;
          saved_at?: string;
        };
        Update: {
          user_id?: string;
          video_id?: string;
          saved_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          video_id: string;
          summary: string;
          structured_notes: Json;
          transcript: string;
          topics: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          summary: string;
          structured_notes: Json;
          transcript: string;
          topics?: Json | null;
          created_at?: string;
        };
        Update: {
          summary?: string;
          structured_notes?: Json;
          transcript?: string;
          topics?: Json | null;
        };
        Relationships: [];
      };
      mindmap: {
        Row: {
          id: string;
          video_id: string;
          mindmap_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          mindmap_json: Json;
          created_at?: string;
        };
        Update: {
          mindmap_json?: Json;
        };
        Relationships: [];
      };
      flashcards: {
        Row: {
          id: string;
          video_id: string;
          question: string;
          answer: string;
          category: string | null;
          difficulty: string | null;
          bullets: Json | null;
          position: number | null;
          learned: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          question: string;
          answer: string;
          category?: string | null;
          difficulty?: string | null;
          bullets?: Json | null;
          position?: number | null;
          learned?: boolean | null;
          created_at?: string;
        };
        Update: {
          question?: string;
          answer?: string;
          category?: string | null;
          difficulty?: string | null;
          bullets?: Json | null;
          position?: number | null;
          learned?: boolean | null;
        };
        Relationships: [];
      };
      visual_insights: {
        Row: {
          id: string;
          video_id: string;
          timestamp: string | null;
          seconds: number | null;
          visual_type: string | null;
          title: string | null;
          image_url: string | null;
          extracted_text: string | null;
          ai_explanation: string | null;
          bullets: Json | null;
          tags: Json | null;
          key_moment: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          timestamp?: string | null;
          seconds?: number | null;
          visual_type?: string | null;
          title?: string | null;
          image_url?: string | null;
          extracted_text?: string | null;
          ai_explanation?: string | null;
          bullets?: Json | null;
          tags?: Json | null;
          key_moment?: boolean | null;
          created_at?: string;
        };
        Update: {
          timestamp?: string | null;
          seconds?: number | null;
          visual_type?: string | null;
          title?: string | null;
          image_url?: string | null;
          extracted_text?: string | null;
          ai_explanation?: string | null;
          bullets?: Json | null;
          tags?: Json | null;
          key_moment?: boolean | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

let singleton: ReturnType<typeof createClient<Database>> | null = null;

export function getDb() {
  if (!singleton) {
    singleton = createClient<Database>(readRequired("SUPABASE_URL"), readRequired("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return singleton;
}
