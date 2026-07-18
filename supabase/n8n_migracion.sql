-- ============================================================
-- n8n · Automatización de leads · Migración
-- Correr en: Supabase Dashboard → SQL Editor → New query → Run
--
-- Agrega la marca de procesamiento que usa el flujo de n8n
-- para no procesar dos veces el mismo lead.
-- ============================================================

begin;

alter table public.prospectos
  add column if not exists n8n_procesado timestamptz;

comment on column public.prospectos.n8n_procesado is
  'Fecha en que n8n procesó este lead (creó oportunidades y notificó). NULL = pendiente.';

-- Índice parcial para que el polling cada 2 min sea barato.
create index if not exists idx_prospectos_n8n_pendientes
  on public.prospectos (created_at)
  where n8n_procesado is null and fuente = 'landing';

commit;
