-- ============================================================
-- LUMO · Embudo Flash seguro · Migración
-- Correr en: Supabase Dashboard → SQL Editor → New query → Run
--
-- Baja fricción para el prospecto, máxima validación en servidor,
-- atribución completa, deduplicación atómica y contacto con IA
-- únicamente autorizado por el asesor.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Eliminar políticas públicas inseguras si existieran.
-- ------------------------------------------------------------
drop policy if exists "Public can insert leads"
  on public.prospectos;

drop policy if exists "Public access"
  on public.prospectos;

-- ------------------------------------------------------------
-- 2. Columnas para atribución, consentimiento y seguimiento.
-- ------------------------------------------------------------
alter table public.prospectos
  add column if not exists telefono_normalizado text,
  add column if not exists fuente text,
  add column if not exists campaña text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists consentimiento_contacto boolean default false,
  add column if not exists consentimiento_contacto_fecha timestamptz,
  add column if not exists consentimiento_version text,
  add column if not exists ultima_solicitud_web timestamptz,
  add column if not exists nota_entrada_web text;

-- ------------------------------------------------------------
-- 3. RLS obligatorio (aislamiento por asesor propietario).
--    El endpoint público inserta con service role DESDE EL
--    SERVIDOR; el navegador nunca toca esta tabla sin sesión.
-- ------------------------------------------------------------
alter table public.prospectos enable row level security;

drop policy if exists "Advisors can read own prospects"
  on public.prospectos;

create policy "Advisors can read own prospects"
  on public.prospectos
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Advisors can insert own prospects"
  on public.prospectos;

create policy "Advisors can insert own prospects"
  on public.prospectos
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Advisors can update own prospects"
  on public.prospectos;

create policy "Advisors can update own prospects"
  on public.prospectos
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Advisors can delete own prospects"
  on public.prospectos;

create policy "Advisors can delete own prospects"
  on public.prospectos
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 4. Índice normal para búsquedas por asesor y fecha.
-- ------------------------------------------------------------
create index if not exists prospectos_user_fecha_idx
  on public.prospectos (user_id, created_at desc);

-- ------------------------------------------------------------
-- 5. Índice ÚNICO parcial: impide duplicados por asesor y
--    teléfono a nivel de base de datos (deduplicación atómica,
--    inmune a condiciones de carrera). La API usa upsert con
--    onConflict: 'user_id,telefono_normalizado'.
-- ------------------------------------------------------------
create unique index if not exists prospectos_user_telefono_unique_idx
  on public.prospectos (user_id, telefono_normalizado)
  where telefono_normalizado is not null;

-- ------------------------------------------------------------
-- 6. Rate limiting real en servidor (además del honeypot).
--    Ventanas por IP y por asesor; solo accesible con service
--    role: sin políticas para anon/authenticated.
-- ------------------------------------------------------------
create table if not exists public.web_rate_limits (
  clave text primary key,          -- ej. 'leads:ip:1.2.3.4' o 'ia:user:uuid'
  contador integer not null default 1,
  ventana_inicio timestamptz not null default now()
);

alter table public.web_rate_limits enable row level security;
-- Sin políticas: solo el service role (que ignora RLS) puede usarla.

-- Función atómica de incremento con ventana deslizante.
create or replace function public.incrementar_rate_limit(
  p_clave text,
  p_ventana_segundos integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contador integer;
begin
  insert into web_rate_limits as w (clave, contador, ventana_inicio)
  values (p_clave, 1, now())
  on conflict (clave) do update
    set contador = case
          when w.ventana_inicio < now() - make_interval(secs => p_ventana_segundos)
          then 1
          else w.contador + 1
        end,
        ventana_inicio = case
          when w.ventana_inicio < now() - make_interval(secs => p_ventana_segundos)
          then now()
          else w.ventana_inicio
        end
  returning contador into v_contador;

  return v_contador;
end;
$$;

-- Solo el service role debe poder ejecutarla.
revoke all on function public.incrementar_rate_limit(text, integer) from public, anon, authenticated;

commit;
