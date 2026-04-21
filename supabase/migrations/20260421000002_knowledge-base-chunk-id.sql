-- Add a deterministic chunk_id (sha256 of source:page:content) to enable idempotent upserts.
-- Existing rows pre-date this column and will have chunk_id = NULL; the unique constraint
-- allows multiple NULLs so the backfill is non-destructive.

alter table public.knowledge_base
  add column if not exists chunk_id text;

create unique index if not exists knowledge_base_chunk_id_key
  on public.knowledge_base (chunk_id)
  where chunk_id is not null;
