-- ============================================================
-- LUMO · Diagnóstico de producción (SOLO LECTURA, no modifica)
-- Correr en Supabase → SQL Editor. Pega los resultados si algo
-- no coincide con lo esperado.
-- ============================================================

-- 1. Objetos existentes: tablas, funciones e índices de prospectos
select 'tabla: ' || tablename as objeto from pg_tables where schemaname = 'public'
union all
select 'funcion: ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
union all
select 'indice prospectos: ' || indexname from pg_indexes
where schemaname = 'public' and tablename = 'prospectos'
order by 1;

-- 2. DUPLICADOS que bloquearían el índice único normal (42P10).
--    Esperado: 0 filas. Si devuelve filas, NO corras la parte A
--    de la reparación hasta fusionar (la migración se protege sola).
select user_id, telefono_normalizado, count(*) as repetidos,
       array_agg(id order by created_at) as ids,
       array_agg(nombre order by created_at) as nombres
from public.prospectos
where telefono_normalizado is not null
group by user_id, telefono_normalizado
having count(*) > 1;

-- 3. Columnas clave que el código necesita. Esperado: 4+ filas.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'prospectos' and column_name in
      ('telefono_normalizado','n8n_procesado','primer_contacto_at','cliente_id','fuente'))
    or (table_name = 'polizas' and column_name = 'numero_poliza')
    or (table_name = 'tramites' and column_name in ('aseguradora','producto'))
    or (table_name = 'diagnosticos' and column_name in ('que_proteger','edad'))
  )
order by table_name, column_name;

-- 4. RLS: estado y políticas por tabla. Esperado: rowsecurity = true
--    en todas; 4 políticas en operativas, 2 en actividades/acciones_ia,
--    1 en ai_usage, 0 en web_rate_limits.
select t.tablename,
       t.rowsecurity as rls_activo,
       count(p.policyname) as num_politicas,
       coalesce(string_agg(p.policyname, ', ' order by p.policyname), '(sin políticas)') as politicas
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename, t.rowsecurity
order by t.tablename;

-- 5. Permisos EXECUTE de las funciones RPC. Esperado:
--    convertir_prospecto_a_cliente y sellar_primer_contacto →
--    authenticated=true; incrementar_rate_limit → solo definer.
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede,
       has_function_privilege('anon', p.oid, 'execute') as anon_puede
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('convertir_prospecto_a_cliente','sellar_primer_contacto','incrementar_rate_limit');

-- 6. Filas huérfanas (invisibles con RLS). Esperado: todo 0.
select 'prospectos' t, count(*) huerfanos from prospectos where user_id is null
union all select 'clientes', count(*) from clientes where user_id is null
union all select 'citas', count(*) from citas where user_id is null
union all select 'oportunidades', count(*) from oportunidades where user_id is null
union all select 'polizas', count(*) from polizas where user_id is null
union all select 'servicios', count(*) from servicios where user_id is null
union all select 'tramites', count(*) from tramites where user_id is null
union all select 'diagnosticos', count(*) from diagnosticos where user_id is null
union all select 'aseguradoras', count(*) from aseguradoras where user_id is null;
