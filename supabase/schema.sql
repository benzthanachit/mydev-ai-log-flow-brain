-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  github_pat text, -- Consider encrypting this at the application layer or using pgcrypto
  github_repo text, -- format: username/repo
  gemini_api_key text, -- Consider encrypting
  slack_webhook_url text, -- Consider encrypting
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) for profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Create logs table for timeline events (Second Brain)
create table public.logs (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  entry_type text not null check (entry_type in ('daily', 'log', 'summary')),
  content text not null, -- The rich text content
  embedding vector(3072), -- Gemini 2.5 uses 3072 dimensions
  log_date date not null default CURRENT_DATE, -- Explicit date for the log
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for logs
alter table public.logs enable row level security;

create policy "Users can view their own logs."
  on logs for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own logs."
  on logs for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own logs."
  on logs for delete
  using ( auth.uid() = user_id );

create policy "Users can update their own logs."
  on logs for update
  using ( auth.uid() = user_id );

-- Create daily_status table for leaves
create table public.daily_status (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  status text not null check (status in ('work', 'sick', 'vacation', 'personal')),
  unique(user_id, date)
);

-- Set up RLS for daily_status
alter table public.daily_status enable row level security;

create policy "Users can view their own status."
  on daily_status for select using ( auth.uid() = user_id );

create policy "Users can insert their own status."
  on daily_status for insert with check ( auth.uid() = user_id );

create policy "Users can update their own status."
  on daily_status for update using ( auth.uid() = user_id );

create policy "Users can delete their own status."
  on daily_status for delete using ( auth.uid() = user_id );

-- Create a function to search for logs (RAG)
create or replace function match_logs (
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id bigint,
  entry_type text,
  content text,
  created_at timestamp with time zone,
  similarity float
)
language sql stable
as $$
  select
    logs.id,
    logs.entry_type,
    logs.content,
    logs.created_at,
    1 - (logs.embedding <=> query_embedding) as similarity
  from logs
  where logs.user_id = p_user_id
    and 1 - (logs.embedding <=> query_embedding) > match_threshold
  order by logs.embedding <=> query_embedding
  limit match_count;
$$;

-- Create a storage bucket for images
insert into storage.buckets (id, name, public) values ('images', 'images', true) on conflict (id) do nothing;

create policy "Images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'images' );

create policy "Users can upload images."
  on storage.objects for insert
  with check ( bucket_id = 'images' and auth.role() = 'authenticated' );
