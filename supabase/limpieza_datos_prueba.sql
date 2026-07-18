-- ============================================================
-- LUMO · Limpieza de datos de prueba
-- APLICADO EN PRODUCCIÓN: 2026-07-18 (manual, SQL Editor)
--
-- ⚠️ DESTRUCTIVO A PROPÓSITO: borra TODOS los datos operativos
-- (prospectos, clientes y su historial completo) y reinicia los
-- IDs en 1. Se usó para retirar la información falsa de pruebas
-- antes del estreno real del CRM.
--
-- NO borra: usuarios de Auth, funciones, triggers, índices,
-- políticas RLS ni configuración.
--
-- No volver a correr salvo que se quiera vaciar el CRM otra vez.
-- ============================================================

truncate table
  public.actividades,
  public.cotizaciones,
  public.polizas,
  public.citas,
  public.oportunidades,
  public.diagnosticos,
  public.tramites,
  public.servicios,
  public.acciones_ia,
  public.prospectos,
  public.clientes
restart identity cascade;

-- Opcionales (descomentado = se aplicó):
-- truncate table public.ai_usage restart identity;      -- consumo IA de pruebas
-- delete from public.web_rate_limits;                   -- contadores de rate limit
-- truncate table public.aseguradoras restart identity;  -- SOLO si el directorio también era de prueba
