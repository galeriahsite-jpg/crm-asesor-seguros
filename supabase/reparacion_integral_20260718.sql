-- ============================================================
-- LUMO · REPARACIÓN INTEGRAL · 2026-07-18
-- Correr en: Supabase Dashboard → SQL Editor → New query → Run
--
-- Migración correctiva NUEVA (no edita migraciones históricas).
-- Idempotente y NO destructiva: se puede correr varias veces.
--
-- CORRIGE:
--   A. Error 42P10 en /api/leads: el índice único era PARCIAL
--      (where telefono_normalizado is not null) y PostgREST no
--      puede inferirlo en ON CONFLICT. Se sustituye por un
--      índice único NORMAL (PostgreSQL permite múltiples NULL,
--      así que los prospectos sin teléfono normalizado no
--      estorban). PROTEGIDO: si existen duplicados reales, NO
--      toca nada y te avisa con un WARNING para fusionarlos
--      manualmente primero.
--   B. Garantiza los objetos que el código necesita y que
--      pudieran faltar en producción (tablas nuevas, columnas,
--      RPCs, RLS), sin recrear lo que ya está bien.
--
-- ROLLBACK (solo si fuera necesario):
--   drop index if exists prospectos_user_tel_norm_uniq;
--   create unique index if not exists prospectos_user_telefono_unique_idx
--     on public.prospectos (user_id, telefono_normalizado)
--     where telefono_normalizado is not null;
-- ============================================================

begin;

-- ------------------------------------------------------------
-- A.1 · Diagnóstico e intercambio SEGURO del índice único.
-- ------------------------------------------------------------
do $$
declare
  v_duplicados integer;
begin
  select count(*) into v_duplicados
  from (
    select user_id, telefono_normalizado
    from public.prospectos
    where telefono_normalizado is not null
    group by user_id, telefono_normalizado
    having count(*) > 1
  ) d;

  if v_duplicados > 0 then
    raise warning
      'REPARACION 42P10 OMITIDA: existen % combinaciones (user_id, telefono_normalizado) duplicadas. '
      'Ejecuta el query de duplicados de SQL_DIAGNOSTICO_PRODUCCION.sql, fusiona manualmente y vuelve a correr esta migración.',
      v_duplicados;
  else
    -- Índice único NORMAL: PostgREST SÍ puede inferirlo en ON CONFLICT.
    create unique index if not exists prospectos_user_tel_norm_uniq
      on public.prospectos (user_id, telefono_normalizado);

    -- El índice parcial viejo queda redundante: se retira.
    -- (No es destructivo: no toca datos y el nuevo índice lo cubre.)
    drop index if exists public.prospectos_user_telefono_unique_idx;

    raise notice 'REPARACION 42P10 APLICADA: índice único normal activo.';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- B.1 · Tablas que el código necesita (si ya existen, no-op).
-- ------------------------------------------------------------

create table if not exists public.actividades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospecto_id uuid references public.prospectos(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  oportunidad_id uuid,
  tipo text not null,
  descripcion text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  oportunidad_id uuid not null references public.oportunidades(id) on delete cascade,
  aseguradora text not null,
  prima text,
  estado text not null default 'Pendiente',
  nota text,
  url_cotizador text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  route text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  success boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.web_rate_limits (
  clave text primary key,
  contador integer not null default 1,
  ventana_inicio timestamptz not null default now()
);

-- ------------------------------------------------------------
-- B.2 · Columnas usadas por el código (todas idempotentes).
--       Solo las de features nuevas; el inventario completo
--       vive en SINCRONIZACION_TOTAL.sql si hiciera falta.
-- ------------------------------------------------------------

alter table public.prospectos
  add column if not exists telefono_normalizado text,
  add column if not exists fuente text,
  add column if not exists n8n_procesado timestamptz,
  add column if not exists primer_contacto_at timestamptz,
  add column if not exists primer_contacto_canal text,
  add column if not exists cliente_id uuid;

alter table public.polizas
  add column if not exists numero_poliza text;

alter table public.tramites
  add column if not exists aseguradora text,
  add column if not exists producto text;

alter table public.diagnosticos
  add column if not exists cliente text,
  add column if not exists edad text,
  add column if not exists dependientes text,
  add column if not exists objetivo text,
  add column if not exists presupuesto text,
  add column if not exists que_proteger text,
  add column if not exists riesgo_preocupante text,
  add column if not exists producto_posible text,
  add column if not exists aseguradoras_consultar text,
  add column if not exists fecha_decision date,
  add column if not exists producto_sugerido text;

-- ------------------------------------------------------------
-- B.3 · Índices de rendimiento (Fase 8: paginación/lectura).
-- ------------------------------------------------------------

create index if not exists idx_prospectos_sin_contacto
  on public.prospectos (created_at)
  where primer_contacto_at is null and estado = 'Nuevo';
create index if not exists idx_prospectos_n8n_pendientes
  on public.prospectos (created_at)
  where n8n_procesado is null and fuente = 'landing';
create index if not exists actividades_prospecto_idx on public.actividades (prospecto_id, created_at desc);
create index if not exists actividades_cliente_idx on public.actividades (cliente_id, created_at desc);
create index if not exists actividades_user_fecha_idx on public.actividades (user_id, created_at desc);
create index if not exists actividades_oportunidad_idx on public.actividades (oportunidad_id, created_at desc);
create index if not exists cotizaciones_oportunidad_idx on public.cotizaciones (oportunidad_id);
create index if not exists cotizaciones_user_fecha_idx on public.cotizaciones (user_id, created_at desc);
create index if not exists ai_usage_user_fecha_idx on public.ai_usage (user_id, created_at desc);

-- ------------------------------------------------------------
-- B.4 · Funciones RPC (firmas EXACTAS que llama el código).
--       create or replace: siempre queda la versión correcta.
-- ------------------------------------------------------------

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

revoke all on function public.incrementar_rate_limit(text, integer) from public, anon, authenticated;

create or replace function public.sellar_primer_contacto(
  p_prospecto_id uuid,
  p_canal text
)
returns void
language sql
security invoker
set search_path = public
as $$
  update prospectos
  set primer_contacto_at = now(),
      primer_contacto_canal = p_canal
  where id = p_prospecto_id
    and primer_contacto_at is null;
$$;

revoke all on function public.sellar_primer_contacto(uuid, text) from public, anon;
grant execute on function public.sellar_primer_contacto(uuid, text) to authenticated;

create or replace function public.convertir_prospecto_a_cliente(
  p_prospecto_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prospecto prospectos%rowtype;
  v_cliente_id uuid;
  v_fecha_postventa date;
begin
  select * into v_prospecto
  from prospectos
  where id = p_prospecto_id
  for update;

  if not found then
    raise exception 'Prospecto no encontrado o sin permiso.';
  end if;

  if v_prospecto.cliente_id is not null or v_prospecto.estado = 'Convertido' then
    raise exception 'Este prospecto ya fue convertido en cliente.';
  end if;

  insert into clientes (nombre, telefono, estado, user_id)
  values (v_prospecto.nombre, v_prospecto.telefono, 'Activo', v_prospecto.user_id)
  returning id into v_cliente_id;

  update citas         set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;
  update oportunidades set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;
  update diagnosticos  set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;
  update tramites      set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;
  update servicios     set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;

  v_fecha_postventa := (now() at time zone 'America/Mexico_City')::date + 15;

  update prospectos set
    estado         = 'Convertido',
    cliente_id     = v_cliente_id,
    proxima_accion = 'Llamar para revisión postventa y pedir referidos',
    fecha_proxima  = v_fecha_postventa
  where id = p_prospecto_id;

  insert into actividades (user_id, prospecto_id, cliente_id, tipo, descripcion)
  values (
    v_prospecto.user_id, p_prospecto_id, v_cliente_id,
    'convertido',
    'Prospecto convertido en cliente. Postventa agendada para ' || v_fecha_postventa
  );

  return v_cliente_id;
end;
$$;

revoke all on function public.convertir_prospecto_a_cliente(uuid) from public, anon;
grant execute on function public.convertir_prospecto_a_cliente(uuid) to authenticated;

-- ------------------------------------------------------------
-- B.5 · RLS de las tablas nuevas (las operativas históricas se
--       cubren con blindaje/SINCRONIZACION; aquí solo lo que
--       podría faltar, idempotente).
-- ------------------------------------------------------------

alter table public.actividades enable row level security;
drop policy if exists "actividades_select_propias" on public.actividades;
create policy "actividades_select_propias" on public.actividades
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "actividades_insert_propias" on public.actividades;
create policy "actividades_insert_propias" on public.actividades
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- Sin update/delete: la línea de tiempo es inmutable desde la app.

alter table public.cotizaciones enable row level security;
drop policy if exists "cotizaciones_select_propias" on public.cotizaciones;
create policy "cotizaciones_select_propias" on public.cotizaciones
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "cotizaciones_insert_propias" on public.cotizaciones;
create policy "cotizaciones_insert_propias" on public.cotizaciones
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "cotizaciones_update_propias" on public.cotizaciones;
create policy "cotizaciones_update_propias" on public.cotizaciones
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "cotizaciones_delete_propias" on public.cotizaciones;
create policy "cotizaciones_delete_propias" on public.cotizaciones
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_propias" on public.ai_usage;
create policy "ai_usage_select_propias" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

alter table public.web_rate_limits enable row level security;

commit;

-- Recargar el caché de esquema de PostgREST (Supabase API)
notify pgrst, 'reload schema';
