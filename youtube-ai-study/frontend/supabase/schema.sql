create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text not null,
  plan text not null default 'free' check (plan in ('free','pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists clerk_user_id text;
create unique index if not exists users_clerk_user_id_key on public.users (clerk_user_id);

create table if not exists public.videos (
  id text primary key,
  user_id text not null,
  youtube_url text not null,
  title text not null,
  thumbnail text,
  source_video_id text not null,
  created_at timestamptz not null default now(),
  constraint videos_user_fk foreign key (user_id) references public.users(clerk_user_id) on delete cascade
);

create table if not exists public.video_content (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null,
  transcript text,
  summary text,
  notes jsonb,
  chapters jsonb,
  quiz jsonb,
  pdf_url text,
  created_at timestamptz not null default now(),
  constraint video_content_video_fk foreign key (video_id) references public.videos(id) on delete cascade
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null,
  summary text,
  structured_notes jsonb,
  transcript text,
  topics jsonb,
  updated_at timestamptz not null default now(),
  constraint notes_video_fk foreign key (video_id) references public.videos(id) on delete cascade
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,
  question text not null,
  answer text not null,
  category text,
  difficulty text,
  bullets jsonb,
  position int default 0,
  learned boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcards_video_fk foreign key (video_id) references public.videos(id) on delete cascade
);

alter table public.flashcards add column if not exists category text;
alter table public.flashcards add column if not exists difficulty text;
alter table public.flashcards add column if not exists bullets jsonb;
alter table public.flashcards add column if not exists created_at timestamptz;

create table if not exists public.mindmap (
  id uuid primary key default gen_random_uuid(),
  video_id text unique not null,
  mindmap_json jsonb,
  updated_at timestamptz not null default now(),
  constraint mindmap_video_fk foreign key (video_id) references public.videos(id) on delete cascade
);

create table if not exists public.visual_insights (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,
  timestamp text,
  seconds numeric,
  visual_type text,
  title text,
  image_url text,
  extracted_text text,
  ai_explanation text,
  bullets jsonb,
  tags jsonb,
  key_moment boolean default false,
  created_at timestamptz not null default now(),
  constraint visual_insights_video_fk foreign key (video_id) references public.videos(id) on delete cascade
);

create index if not exists idx_visual_insights_video_id on public.visual_insights(video_id);

create table if not exists public.library (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  video_id text not null,
  saved_at timestamptz not null default now(),
  constraint library_user_fk foreign key (user_id) references public.users(clerk_user_id) on delete cascade,
  constraint library_video_fk foreign key (video_id) references public.videos(id) on delete cascade,
  constraint library_unique unique (user_id, video_id)
);

create index if not exists idx_videos_user_id_created_at on public.videos(user_id, created_at desc);
create index if not exists idx_library_user_id_saved_at on public.library(user_id, saved_at desc);
