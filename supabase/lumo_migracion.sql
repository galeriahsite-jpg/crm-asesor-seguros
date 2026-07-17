-- ============================================================
-- LUMO · Fase 1 · Migración
-- Correr en: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Historial de acciones de IA (punto 15 del documento LUMO)
-- Guarda qué propuso LUMO, qué confirmó el asesor y qué se ejecutó.
create table if not exists acciones_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  texto_original text,           -- lo que dictó/escribió el asesor
  propuesta jsonb,               -- acciones que propuso LUMO
  confirmadas jsonb,             -- acciones que el asesor confirmó (con sus ediciones)
  resultado text,                -- 'ejecutado' | 'parcial' | 'rechazado' | 'error'
  created_at timestamptz not null default now()
);

alter table acciones_ia enable row level security;

drop policy if exists "acciones_ia_select_propias" on acciones_ia;
create policy "acciones_ia_select_propias"
  on acciones_ia for select
  using (auth.uid() = user_id);

drop policy if exists "acciones_ia_insert_propias" on acciones_ia;
create policy "acciones_ia_insert_propias"
  on acciones_ia for insert
  with check (auth.uid() = user_id);

-- Índice para consultar el historial reciente
create index if not exists acciones_ia_user_fecha
  on acciones_ia (user_id, created_at desc);
