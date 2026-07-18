-- ============================================================
-- LUMO · Fase Operativa · Migración
-- Correr en: Supabase Dashboard → SQL Editor → New query → Run
-- (Correr DESPUÉS de blindaje_migracion.sql)
--
-- Cierra las brechas del comparativo de mercado que SÍ están en
-- el enfoque LUMO (ENFOQUE_LUMO.md, Fase A/C):
--   1. Línea de tiempo universal: tabla `actividades`.
--   2. Velocidad de respuesta: primer_contacto_at en prospectos.
--   3. Conversión v2: registra la actividad en la transacción.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Línea de tiempo universal.
--    Cada evento del ciclo (lead, mensaje, llamada, cita, etapa,
--    conversión, servicio…) queda en una sola cronología.
--    Es la infraestructura del briefing, del registro
--    post-llamada y del motor de siguiente mejor acción.
-- ------------------------------------------------------------

create table if not exists public.actividades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospecto_id uuid references public.prospectos(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  oportunidad_id uuid references public.oportunidades(id) on delete set null,
  tipo text not null,
    -- lead_recibido | contacto_whatsapp | contacto_llamada |
    -- mensaje_generado | resultado_contacto | cita_creada |
    -- cita_resultado | diagnostico_creado | oportunidad_creada |
    -- cotizacion_agregada | etapa_cambiada | nota_registrada |
    -- convertido | servicio_abierto | tramite_creado |
    -- renovacion_contactada | secuencia_enviada
  descripcion text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.actividades enable row level security;

drop policy if exists "actividades_select_propias" on public.actividades;
create policy "actividades_select_propias" on public.actividades
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "actividades_insert_propias" on public.actividades;
create policy "actividades_insert_propias" on public.actividades
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Sin update/delete para authenticated: la línea de tiempo es
-- histórica e inmutable desde la app (auditoría confiable).

create index if not exists actividades_prospecto_idx
  on public.actividades (prospecto_id, created_at desc);
create index if not exists actividades_cliente_idx
  on public.actividades (cliente_id, created_at desc);
create index if not exists actividades_user_fecha_idx
  on public.actividades (user_id, created_at desc);

-- ------------------------------------------------------------
-- 2. Velocidad de respuesta (speed-to-lead).
--    primer_contacto_at se sella la PRIMERA vez que el asesor
--    contacta al prospecto (WhatsApp, llamada o resultado).
-- ------------------------------------------------------------

alter table public.prospectos
  add column if not exists primer_contacto_at timestamptz,
  add column if not exists primer_contacto_canal text;

comment on column public.prospectos.primer_contacto_at is
  'Primer contacto real del asesor. NULL = lead aún sin atender.';

-- Índice para el motor de decisiones (leads sin contactar).
create index if not exists idx_prospectos_sin_contacto
  on public.prospectos (created_at)
  where primer_contacto_at is null and estado = 'Nuevo';

-- Sellado atómico: solo escribe si aún es NULL (idempotente).
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

-- ------------------------------------------------------------
-- 3. Conversión v2: misma transacción, ahora también deja la
--    actividad "convertido" en la línea de tiempo.
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

  -- Línea de tiempo (misma transacción: o todo, o nada).
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
