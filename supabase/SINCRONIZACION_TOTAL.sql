-- ============================================================
-- LUMO · SINCRONIZACIÓN TOTAL (End-to-End)
-- Correr en: Supabase Dashboard → SQL Editor → New query → Run
--
-- Script maestro IDEMPOTENTE: alinea la base de datos con TODO
-- lo que el código usa hoy (frontend, APIs y flujos n8n).
-- Se puede correr las veces que sea sin romper nada:
--   · create table IF NOT EXISTS
--   · alter table ADD COLUMN IF NOT EXISTS
--   · create index IF NOT EXISTS
--   · create OR REPLACE function
--   · drop policy IF EXISTS + create policy
--
-- Desajustes detectados en la auditoría y cubiertos aquí:
--   1. polizas: el código usa `numero_poliza` (no `numero`).
--   2. diagnosticos: el código usa DOS juegos de campos
--      (módulo: cliente/edad/dependientes/objetivo/presupuesto;
--       ficha: que_proteger/riesgo_preocupante/producto_posible/
--       aseguradoras_consultar/fecha_decision) — se crean todos.
--   3. tramites: el código usa `aseguradora` y `producto`, y el
--      insert no manda `estado` → default 'En proceso'.
-- ============================================================

begin;

-- ============================================================
-- 1. TABLAS BASE (mínimas; si ya existen, no pasa nada)
-- ============================================================

create table if not exists public.prospectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.polizas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.tramites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.aseguradoras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.acciones_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.actividades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.web_rate_limits (
  clave text primary key,
  contador integer not null default 1,
  ventana_inicio timestamptz not null default now()
);

-- ============================================================
-- 2. COLUMNAS (inventario EXACTO de lo que usa el código)
-- ============================================================

-- prospectos ---------------------------------------------------
alter table public.prospectos
  add column if not exists nombre text,
  add column if not exists telefono text,
  add column if not exists producto text,
  add column if not exists nota text,
  add column if not exists estado text default 'Nuevo',
  add column if not exists proxima_accion text,
  add column if not exists fecha_proxima date,
  add column if not exists cliente_id uuid,
  -- Embudo Flash
  add column if not exists telefono_normalizado text,
  add column if not exists fuente text,
  add column if not exists "campaña" text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists consentimiento_contacto boolean default false,
  add column if not exists consentimiento_contacto_fecha timestamptz,
  add column if not exists consentimiento_version text,
  add column if not exists ultima_solicitud_web timestamptz,
  add column if not exists nota_entrada_web text,
  -- n8n
  add column if not exists n8n_procesado timestamptz,
  -- Velocidad de respuesta
  add column if not exists primer_contacto_at timestamptz,
  add column if not exists primer_contacto_canal text;

-- clientes -----------------------------------------------------
alter table public.clientes
  add column if not exists nombre text,
  add column if not exists telefono text,
  add column if not exists estado text default 'Activo';

-- polizas ------------------------------------------------------
-- ⚠️ El código usa `numero_poliza` (no `numero`).
alter table public.polizas
  add column if not exists cliente_id uuid,
  add column if not exists aseguradora text,
  add column if not exists producto text,
  add column if not exists numero_poliza text,
  add column if not exists vencimiento date,
  add column if not exists estado text default 'Activa';

-- citas --------------------------------------------------------
alter table public.citas
  add column if not exists titulo text,
  add column if not exists fecha date,
  add column if not exists hora text,
  add column if not exists tipo text,
  add column if not exists estado text default 'Pendiente',
  add column if not exists prospecto_id uuid,
  add column if not exists cliente_id uuid;

-- oportunidades ------------------------------------------------
alter table public.oportunidades
  add column if not exists cliente text,
  add column if not exists producto text,
  add column if not exists aseguradora text,   -- legado (modelo nuevo: cotizaciones)
  add column if not exists prima text,          -- legado (modelo nuevo: cotizaciones)
  add column if not exists estado text default 'Por diagnosticar',
  add column if not exists prospecto_id uuid,
  add column if not exists cliente_id uuid;

-- cotizaciones -------------------------------------------------
alter table public.cotizaciones
  add column if not exists oportunidad_id uuid,
  add column if not exists aseguradora text,
  add column if not exists prima text,
  add column if not exists estado text not null default 'Pendiente',
  add column if not exists nota text,
  add column if not exists url_cotizador text;

-- servicios ----------------------------------------------------
alter table public.servicios
  add column if not exists cliente text,
  add column if not exists tipo text,
  add column if not exists descripcion text,
  add column if not exists nota text,
  add column if not exists estado text default 'Reportado',
  add column if not exists prospecto_id uuid,
  add column if not exists cliente_id uuid;

-- tramites -----------------------------------------------------
-- ⚠️ El código usa `aseguradora` y `producto`; el insert no
--    manda `estado` → default obligatorio.
alter table public.tramites
  add column if not exists cliente text,
  add column if not exists aseguradora text,
  add column if not exists producto text,
  add column if not exists folio text,
  add column if not exists nota text,
  add column if not exists estado text default 'En proceso',
  add column if not exists prospecto_id uuid,
  add column if not exists cliente_id uuid;

-- diagnosticos -------------------------------------------------
-- ⚠️ El código usa DOS juegos de campos (módulo y ficha).
alter table public.diagnosticos
  add column if not exists cliente text,
  -- Juego del módulo /diagnosticos
  add column if not exists edad text,
  add column if not exists dependientes text,
  add column if not exists objetivo text,
  add column if not exists presupuesto text,
  -- Juego de la ficha 360° (6 preguntas)
  add column if not exists que_proteger text,
  add column if not exists riesgo_preocupante text,
  add column if not exists producto_posible text,
  add column if not exists aseguradoras_consultar text,
  add column if not exists fecha_decision date,
  -- Comunes
  add column if not exists producto_sugerido text,
  add column if not exists nota text,
  add column if not exists prospecto_id uuid,
  add column if not exists cliente_id uuid;

-- aseguradoras -------------------------------------------------
alter table public.aseguradoras
  add column if not exists nombre text,
  add column if not exists portal_url text,
  add column if not exists usuario text,
  add column if not exists ejecutivo text,
  add column if not exists telefono text;

-- acciones_ia --------------------------------------------------
alter table public.acciones_ia
  add column if not exists texto_original text,
  add column if not exists propuesta jsonb,
  add column if not exists confirmadas jsonb,
  add column if not exists resultado text;

-- actividades --------------------------------------------------
alter table public.actividades
  add column if not exists prospecto_id uuid,
  add column if not exists cliente_id uuid,
  add column if not exists oportunidad_id uuid,
  add column if not exists tipo text,
  add column if not exists descripcion text,
  add column if not exists metadata jsonb;

-- ai_usage -----------------------------------------------------
alter table public.ai_usage
  add column if not exists route text,
  add column if not exists model text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists duration_ms integer,
  add column if not exists success boolean not null default true;

-- ============================================================
-- 3. LLAVES FORÁNEAS (idempotentes: ignora si ya existen)
-- ============================================================

do $$ begin
  alter table public.prospectos add constraint prospectos_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.polizas add constraint polizas_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.citas add constraint citas_prospecto_id_fkey
    foreign key (prospecto_id) references public.prospectos(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.citas add constraint citas_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.oportunidades add constraint oportunidades_prospecto_id_fkey
    foreign key (prospecto_id) references public.prospectos(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.oportunidades add constraint oportunidades_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.cotizaciones add constraint cotizaciones_oportunidad_id_fkey
    foreign key (oportunidad_id) references public.oportunidades(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.servicios add constraint servicios_prospecto_id_fkey
    foreign key (prospecto_id) references public.prospectos(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.servicios add constraint servicios_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.tramites add constraint tramites_prospecto_id_fkey
    foreign key (prospecto_id) references public.prospectos(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.tramites add constraint tramites_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.diagnosticos add constraint diagnosticos_prospecto_id_fkey
    foreign key (prospecto_id) references public.prospectos(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.diagnosticos add constraint diagnosticos_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.actividades add constraint actividades_prospecto_id_fkey
    foreign key (prospecto_id) references public.prospectos(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.actividades add constraint actividades_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.actividades add constraint actividades_oportunidad_id_fkey
    foreign key (oportunidad_id) references public.oportunidades(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ============================================================
-- 4. ÍNDICES
-- ============================================================

create index if not exists prospectos_user_fecha_idx
  on public.prospectos (user_id, created_at desc);
create unique index if not exists prospectos_user_telefono_unique_idx
  on public.prospectos (user_id, telefono_normalizado)
  where telefono_normalizado is not null;
create index if not exists idx_prospectos_n8n_pendientes
  on public.prospectos (created_at)
  where n8n_procesado is null and fuente = 'landing';
create index if not exists idx_prospectos_sin_contacto
  on public.prospectos (created_at)
  where primer_contacto_at is null and estado = 'Nuevo';
create index if not exists citas_prospecto_idx on public.citas (prospecto_id);
create index if not exists citas_cliente_idx on public.citas (cliente_id);
create index if not exists oportunidades_prospecto_idx on public.oportunidades (prospecto_id);
create index if not exists oportunidades_cliente_idx on public.oportunidades (cliente_id);
create index if not exists cotizaciones_oportunidad_idx on public.cotizaciones (oportunidad_id);
create index if not exists cotizaciones_user_fecha_idx on public.cotizaciones (user_id, created_at desc);
create index if not exists polizas_cliente_idx on public.polizas (cliente_id);
create index if not exists acciones_ia_user_fecha on public.acciones_ia (user_id, created_at desc);
create index if not exists actividades_prospecto_idx on public.actividades (prospecto_id, created_at desc);
create index if not exists actividades_cliente_idx on public.actividades (cliente_id, created_at desc);
create index if not exists actividades_user_fecha_idx on public.actividades (user_id, created_at desc);
create index if not exists ai_usage_user_fecha_idx on public.ai_usage (user_id, created_at desc);

-- ============================================================
-- 5. FUNCIONES RPC (nombres y parámetros EXACTOS del código)
--    · incrementar_rate_limit(p_clave text, p_ventana_segundos integer) → integer
--    · sellar_primer_contacto(p_prospecto_id uuid, p_canal text) → void
--    · convertir_prospecto_a_cliente(p_prospecto_id uuid) → uuid
-- ============================================================

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

  -- Línea de tiempo: ÚNICO lugar donde se registra 'convertido'
  -- (el frontend NO lo duplica; auditado).
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

-- ============================================================
-- 6. RLS COMPLETO
--    · Tablas operativas: 4 políticas (select/insert/update/delete)
--      con (select auth.uid()) = user_id.
--    · actividades y acciones_ia: solo select + insert (historial
--      inmutable desde la app).
--    · ai_usage: solo select propio (inserta el service role).
--    · web_rate_limits: sin políticas (solo service role).
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'prospectos', 'clientes', 'citas', 'oportunidades', 'cotizaciones',
    'polizas', 'servicios', 'tramites', 'diagnosticos', 'aseguradoras'
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

-- actividades: select + insert (sin update/delete: historial inmutable)
alter table public.actividades enable row level security;
drop policy if exists "actividades_select_propias" on public.actividades;
create policy "actividades_select_propias" on public.actividades
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "actividades_insert_propias" on public.actividades;
create policy "actividades_insert_propias" on public.actividades
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- acciones_ia: select + insert
alter table public.acciones_ia enable row level security;
drop policy if exists "acciones_ia_select_propias" on public.acciones_ia;
create policy "acciones_ia_select_propias" on public.acciones_ia
  for select using (auth.uid() = user_id);
drop policy if exists "acciones_ia_insert_propias" on public.acciones_ia;
create policy "acciones_ia_insert_propias" on public.acciones_ia
  for insert with check (auth.uid() = user_id);

-- ai_usage: el asesor lee su consumo; solo service role inserta
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_propias" on public.ai_usage;
create policy "ai_usage_select_propias" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- web_rate_limits: sin políticas → solo service role
alter table public.web_rate_limits enable row level security;

-- ============================================================
-- 7. VERIFICACIÓN DE HUÉRFANOS (informativa, no modifica nada)
--    Si alguna fila tiene user_id NULL, no será visible con RLS.
--    Repara con: update <tabla> set user_id='TU-UUID' where user_id is null;
-- ============================================================
-- select 'prospectos' t, count(*) from prospectos where user_id is null
-- union all select 'clientes', count(*) from clientes where user_id is null
-- union all select 'citas', count(*) from citas where user_id is null
-- union all select 'oportunidades', count(*) from oportunidades where user_id is null
-- union all select 'polizas', count(*) from polizas where user_id is null
-- union all select 'servicios', count(*) from servicios where user_id is null
-- union all select 'tramites', count(*) from tramites where user_id is null
-- union all select 'diagnosticos', count(*) from diagnosticos where user_id is null
-- union all select 'aseguradoras', count(*) from aseguradoras where user_id is null;

commit;

-- Recargar el caché de esquema de PostgREST (Supabase API)
notify pgrst, 'reload schema';
