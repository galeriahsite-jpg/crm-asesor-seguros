-- ============================================================
-- LUMO · País del teléfono (MX/US) — soporte frontera
-- PENDIENTE DE APLICAR (correr manualmente en SQL Editor).
--
-- Agrega `telefono_pais` a prospectos y clientes:
--   'MX' → WhatsApp con prefijo 52 (default)
--   'US' → WhatsApp con prefijo 1
-- El campo `telefono` sigue guardando 10 dígitos limpios.
--
-- Idempotente y no destructivo.
-- Rollback:
--   alter table public.prospectos drop column if exists telefono_pais;
--   alter table public.clientes  drop column if exists telefono_pais;
-- ============================================================

alter table public.prospectos
  add column if not exists telefono_pais text default 'MX';

alter table public.clientes
  add column if not exists telefono_pais text default 'MX';

-- Backfill: los números existentes son mexicanos.
update public.prospectos set telefono_pais = 'MX'
where telefono is not null and telefono_pais is null;

update public.clientes set telefono_pais = 'MX'
where telefono is not null and telefono_pais is null;

-- Nota sobre deduplicación: el índice único de prospectos sigue
-- siendo (user_id, telefono_normalizado) a 10 dígitos. En el caso
-- extremadamente raro de que un número MX y uno US compartan los
-- mismos 10 dígitos, se tratarían como duplicado; aceptable para
-- un asesor individual y documentado aquí a propósito.

notify pgrst, 'reload schema';
