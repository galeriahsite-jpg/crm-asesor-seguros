-- ============================================================
-- LUMO · Esquema base reproducible
--
-- Propósito: poder recrear la base COMPLETA desde cero
-- (staging, recuperación, CI). Riesgo alto 5 de la auditoría:
-- el repo no podía reconstruir la base de datos.
--
-- ⚠️ NO correr sobre la base de producción existente: ahí las
-- tablas ya existen (aunque `if not exists` lo hace inofensivo,
-- no agrega columnas a tablas ya creadas). En producción corre
-- solo las migraciones incrementales:
--   1. embudo_migracion.sql
--   2. lumo_migracion.sql
--   3. n8n_migracion.sql
--   4. blindaje_migracion.sql
--
-- En un proyecto Supabase NUEVO, este archivo lo crea todo:
-- correr esquema_base.sql y ya (incluye lo de las 4 migraciones).
--
-- Nota: columnas inferidas del código de la app. Si producción
-- tiene columnas extra creadas a mano, agrégalas aquí para
-- mantener este archivo como fuente de verdad.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Tablas principales
-- ------------------------------------------------------------

create table if not exists public.prospectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  telefono text,
  producto text,
  nota text,
  estado text not null default 'Nuevo',
    -- Nuevo | Contactado | Calificado | Sin respuesta | Perdido | Convertido
  proxima_accion text,
  fecha_proxima date,
  cliente_id uuid,
  -- Embudo Flash (embudo_migracion.sql)
  telefono_normalizado text,
  fuente text,
  "campaña" text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  consentimiento_contacto boolean default false,
  consentimiento_contacto_fecha timestamptz,
  consentimiento_version text,
  ultima_solicitud_web timestamptz,
  nota_entrada_web text,
  -- n8n (n8n_migracion.sql)
  n8n_procesado timestamptz,
  -- Velocidad de respuesta (operativa_migracion.sql)
  primer_contacto_at timestamptz,
  primer_contacto_canal text,
  created_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  telefono text,
  estado text not null default 'Activo',
  created_at timestamptz not null default now()
);

-- FK de prospectos.cliente_id (después de crear clientes)
do $$ begin
  alter table public.prospectos
    add constraint prospectos_cliente_id_fkey
    foreign key (cliente_id) references public.clientes(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.polizas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  aseguradora text,
  numero_poliza text,   -- ⚠️ nombre exacto que usa el código
  producto text,
  vencimiento date,
  estado text default 'Activa',
  created_at timestamptz not null default now()
);

create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text,
  fecha date,
  hora text,
  tipo text,
    -- Llamada | Videollamada | Visita | Diagnóstico | Seguimiento | Servicio
  estado text not null default 'Pendiente',
    -- Pendiente | Reprogramada | Completada | Cancelada
  prospecto_id uuid references public.prospectos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente text,               -- nombre en texto (histórico)
  producto text,
  aseguradora text,           -- legado: en el modelo nuevo vive en cotizaciones
  prima text,                 -- legado: en el modelo nuevo vive en cotizaciones
  estado text not null default 'Por diagnosticar',
    -- Por diagnosticar | Cotizando | Propuesta presentada | Negociación
    -- | Aceptada | Trámite en aseguradora | Emitida | Ganada | Perdida
  prospecto_id uuid references public.prospectos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  created_at timestamptz not null default now()
);

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

create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente text,
  tipo text,
    -- Duda sobre póliza | Cambio de datos | Aclaración de pago | Siniestro | Otro
  descripcion text,
  nota text,
  estado text not null default 'Reportado',
  prospecto_id uuid references public.prospectos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tramites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente text,
  aseguradora text,
  producto text,
  folio text,
  nota text,
  estado text default 'En proceso',
    -- En proceso | Información incompleta | Requisito adicional | Pago pendiente | ...
  prospecto_id uuid references public.prospectos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospecto_id uuid references public.prospectos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente text,
  -- Juego de campos del módulo /diagnosticos
  edad text,
  dependientes text,
  objetivo text,
  presupuesto text,
  -- Juego de campos de la ficha 360° (6 preguntas)
  que_proteger text,
  riesgo_preocupante text,
  producto_posible text,
  aseguradoras_consultar text,
  fecha_decision date,
  -- Comunes
  producto_sugerido text,
  nota text,
  created_at timestamptz not null default now()
);

create table if not exists public.aseguradoras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  portal_url text,
  usuario text,
  ejecutivo text,
  telefono text,
  created_at timestamptz not null default now()
);

create table if not exists public.actividades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospecto_id uuid references public.prospectos(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  oportunidad_id uuid references public.oportunidades(id) on delete set null,
  tipo text not null,
  descripcion text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.acciones_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  texto_original text,
  propuesta jsonb,
  confirmadas jsonb,
  resultado text,
  created_at timestamptz not null default now()
);

create table if not exists public.web_rate_limits (
  clave text primary key,
  contador integer not null default 1,
  ventana_inicio timestamptz not null default now()
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

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------

create index if not exists prospectos_user_fecha_idx
  on public.prospectos (user_id, created_at desc);
-- Índice único NORMAL (no parcial): PostgREST no puede inferir
-- índices parciales en ON CONFLICT (error 42P10). Los NULL
-- múltiples están permitidos en índices únicos normales.
create unique index if not exists prospectos_user_tel_norm_uniq
  on public.prospectos (user_id, telefono_normalizado);
create index if not exists idx_prospectos_n8n_pendientes
  on public.prospectos (created_at)
  where n8n_procesado is null and fuente = 'landing';
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
create index if not exists idx_prospectos_sin_contacto
  on public.prospectos (created_at)
  where primer_contacto_at is null and estado = 'Nuevo';
create index if not exists ai_usage_user_fecha_idx on public.ai_usage (user_id, created_at desc);

-- ------------------------------------------------------------
-- RLS: patrón único de aislamiento por asesor en TODAS
-- las tablas operativas.
-- ------------------------------------------------------------

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

-- actividades: lectura e inserción propias; sin update/delete
-- (la línea de tiempo es histórica e inmutable desde la app).
alter table public.actividades enable row level security;
drop policy if exists "actividades_select_propias" on public.actividades;
create policy "actividades_select_propias" on public.actividades
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "actividades_insert_propias" on public.actividades;
create policy "actividades_insert_propias" on public.actividades
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- acciones_ia: solo lectura e inserción propias (sin update/delete).
alter table public.acciones_ia enable row level security;
drop policy if exists "acciones_ia_select_propias" on public.acciones_ia;
create policy "acciones_ia_select_propias" on public.acciones_ia
  for select using (auth.uid() = user_id);
drop policy if exists "acciones_ia_insert_propias" on public.acciones_ia;
create policy "acciones_ia_insert_propias" on public.acciones_ia
  for insert with check (auth.uid() = user_id);

-- web_rate_limits: sin políticas → solo service role.
alter table public.web_rate_limits enable row level security;

-- ai_usage: el asesor lee su consumo; solo service role inserta.
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_propias" on public.ai_usage;
create policy "ai_usage_select_propias" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- Funciones
-- ------------------------------------------------------------

-- Rate limiting atómico con ventana deslizante (Embudo Flash).
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

-- Sellado atómico del primer contacto (speed-to-lead).
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

-- Conversión transaccional prospecto → cliente (ver operativa_migracion.sql, v2).
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

commit;
