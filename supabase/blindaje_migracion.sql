-- ============================================================
-- LUMO · Blindaje + Reestructura de oportunidades · Migración
-- Correr en: Supabase Dashboard → SQL Editor → New query → Run
-- (Correr DESPUÉS de embudo_migracion.sql, lumo_migracion.sql
--  y n8n_migracion.sql, sobre la base existente.)
--
-- Contenido:
--   1. RLS explícito en TODAS las tablas del CRM (paso 10 de la
--      hoja de ruta: antes solo estaba en el repo para
--      prospectos, acciones_ia y web_rate_limits).
--   2. Función transaccional convertir_prospecto_a_cliente
--      (riesgo crítico 2: conversión atómica, sin estados a medias).
--   3. Tabla cotizaciones anidada a oportunidades (nuevo modelo:
--      1 oportunidad por persona/producto → N cotizaciones por
--      aseguradora; corrige la distorsión de métricas).
--   4. Tabla ai_usage (monitoreo de consumo de IA).
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. RLS en todas las tablas operativas.
--    Patrón único: cada asesor solo ve y toca sus filas.
--    Idempotente: drop if exists + create.
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'citas', 'oportunidades', 'polizas',
    'servicios', 'tramites', 'diagnosticos', 'aseguradoras'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_select_propias" on public.%I', t, t);
    execute format(
      'create policy "%s_select_propias" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t, t);

    execute format('drop policy if exists "%s_insert_propias" on public.%I', t, t);
    execute format(
      'create policy "%s_insert_propias" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t, t);

    execute format('drop policy if exists "%s_update_propias" on public.%I', t, t);
    execute format(
      'create policy "%s_update_propias" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t, t);

    execute format('drop policy if exists "%s_delete_propias" on public.%I', t, t);
    execute format(
      'create policy "%s_delete_propias" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t, t);
  end loop;
end;
$$;

-- ⚠️ Si alguna fila vieja tiene user_id NULL dejará de ser visible.
-- Detecta huérfanos antes con:
--   select 'clientes' t, count(*) from clientes where user_id is null
--   union all select 'citas', count(*) from citas where user_id is null
--   union all select 'oportunidades', count(*) from oportunidades where user_id is null
--   union all select 'polizas', count(*) from polizas where user_id is null
--   union all select 'servicios', count(*) from servicios where user_id is null
--   union all select 'tramites', count(*) from tramites where user_id is null
--   union all select 'diagnosticos', count(*) from diagnosticos where user_id is null
--   union all select 'aseguradoras', count(*) from aseguradoras where user_id is null;
-- Y repáralos con (sustituye TU-UUID):
--   update <tabla> set user_id = 'TU-UUID' where user_id is null;

-- ------------------------------------------------------------
-- 2. Conversión transaccional prospecto → cliente.
--    security invoker: corre con los permisos del asesor que
--    llama, así RLS sigue aplicando dentro de la función.
--    Todo ocurre en UNA transacción: o migra completo o nada.
-- ------------------------------------------------------------

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
  -- Bloquea la fila (evita doble conversión concurrente).
  -- RLS garantiza que solo encuentra prospectos del asesor.
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

  -- Migrar historial completo al nuevo cliente.
  update citas         set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;
  update oportunidades set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;
  update diagnosticos  set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;
  update tramites      set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;
  update servicios     set cliente_id = v_cliente_id where prospecto_id = p_prospecto_id;

  -- Sellar el prospecto + actividad postventa a 15 días.
  v_fecha_postventa := (now() at time zone 'America/Mexico_City')::date + 15;

  update prospectos set
    estado         = 'Convertido',
    cliente_id     = v_cliente_id,
    proxima_accion = 'Llamar para revisión postventa y pedir referidos',
    fecha_proxima  = v_fecha_postventa
  where id = p_prospecto_id;

  return v_cliente_id;
end;
$$;

revoke all on function public.convertir_prospecto_a_cliente(uuid) from public, anon;
grant execute on function public.convertir_prospecto_a_cliente(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Nuevo modelo: oportunidad → cotizaciones por aseguradora.
--    La oportunidad representa UNA intención comercial;
--    las alternativas por aseguradora viven en cotizaciones.
-- ------------------------------------------------------------

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  oportunidad_id uuid not null references public.oportunidades(id) on delete cascade,
  aseguradora text not null,
  prima text,
  estado text not null default 'Pendiente',
    -- Pendiente | Cotizada | Presentada | Elegida | Descartada
  nota text,
  url_cotizador text,
  created_at timestamptz not null default now()
);

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

create index if not exists cotizaciones_oportunidad_idx
  on public.cotizaciones (oportunidad_id);
create index if not exists cotizaciones_user_fecha_idx
  on public.cotizaciones (user_id, created_at desc);

-- ------------------------------------------------------------
-- 3b. OPCIONAL: consolidar oportunidades viejas creadas por n8n
--     (varias filas 'Cotizando' por el mismo prospecto → una
--     oportunidad + N cotizaciones).
--     ⚠️ REVISA ANTES DE CORRER. Descomenta solo si quieres
--     migrar los datos históricos. Haz backup primero
--     (Database → Backups).
-- ------------------------------------------------------------
-- with grupos as (
--   select prospecto_id, user_id, producto,
--          min(created_at) as primera,
--          (array_agg(id order by created_at))[1] as id_principal
--   from oportunidades
--   where prospecto_id is not null and estado = 'Cotizando'
--   group by prospecto_id, user_id, producto
--   having count(*) > 1
-- ),
-- duplicadas as (
--   select o.id, o.aseguradora, o.prima, o.user_id, g.id_principal
--   from oportunidades o
--   join grupos g on g.prospecto_id = o.prospecto_id
--                and g.producto = o.producto
--                and o.estado = 'Cotizando'
--   where o.id <> g.id_principal
-- ),
-- movidas as (
--   insert into cotizaciones (user_id, oportunidad_id, aseguradora, prima, estado)
--   select user_id, id_principal, coalesce(aseguradora, 'Por definir'), prima, 'Pendiente'
--   from duplicadas
--   returning 1
-- )
-- delete from oportunidades where id in (select id from duplicadas);

-- ------------------------------------------------------------
-- 4. Monitoreo de consumo de IA.
--    Insertan solo las rutas del servidor (service role).
--    El asesor puede consultar su propio consumo.
-- ------------------------------------------------------------

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  route text not null,               -- 'lumo' | 'lumo-dictado' | 'generar-mensaje'
  model text,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  success boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_propias" on public.ai_usage;
create policy "ai_usage_select_propias" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);
-- Sin política de insert para authenticated: solo el service role inserta.

create index if not exists ai_usage_user_fecha_idx
  on public.ai_usage (user_id, created_at desc);

commit;
