-- mxbai-embed-large produces 1024-dim vectors, not 1536
-- Drop and recreate the embedding column + index with the correct dimension
alter table public.knowledge_base
  drop column if exists embedding;

alter table public.knowledge_base
  add column embedding extensions.vector(1024);

drop index if exists public.knowledge_base_embedding_idx;

create index if not exists knowledge_base_embedding_idx
  on public.knowledge_base
  using hnsw (embedding extensions.vector_cosine_ops);

-- Recreate match_knowledge with the corrected dimension
create or replace function public.match_knowledge(
  query_embedding extensions.vector(1024),
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
