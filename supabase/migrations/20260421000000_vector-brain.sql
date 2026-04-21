-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Knowledge base table for semantic search
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- HNSW index for fast approximate nearest-neighbour search (cosine)
create index if not exists knowledge_base_embedding_idx
  on public.knowledge_base
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.knowledge_base enable row level security;

-- Experts and admins can manage the knowledge base; service role writes via edge functions
create policy "Knowledge base: experts and admins can select"
  on public.knowledge_base for select
  using (
    public.has_role(auth.uid(), 'expert'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
  );

create policy "Knowledge base: admins can insert"
  on public.knowledge_base for insert
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Knowledge base: admins can update"
  on public.knowledge_base for update
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Knowledge base: admins can delete"
  on public.knowledge_base for delete
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RPC: cosine similarity search over the knowledge base
create or replace function public.match_knowledge(
  query_embedding extensions.vector(1536),
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
security definer
set search_path = public, extensions
as $$
  select
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) as similarity
  from public.knowledge_base kb
  where 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;
