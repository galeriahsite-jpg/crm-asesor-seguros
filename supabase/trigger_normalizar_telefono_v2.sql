-- ============================================================
-- LUMO · Normalización de teléfono v2 — regla ÚNICA del sistema
-- PENDIENTE DE APLICAR (correr manualmente en SQL Editor).
-- Sustituye a trigger_normalizar_telefono.sql (v1).
--
-- Diferencia vs v1: la v1 hacía right(digitos, 10) con cualquier
-- número largo, "normalizando" números que la API rechaza (ej. un
-- número de 11 dígitos sin prefijo 52). La v2 usa EXACTAMENTE la
-- misma regla que /api/leads y que app/lib/telefono.ts:
--   válido = 10 dígitos, o 12 con prefijo 52, o 13 con 521;
--   cualquier otra cosa → telefono_normalizado = NULL.
-- Así la base y el código nunca discrepan.
--
-- Idempotente: se puede correr las veces que sea.
-- Rollback: volver a correr trigger_normalizar_telefono.sql (v1).
-- ============================================================

create or replace function public.normalizar_telefono_prospecto()
returns trigger
language plpgsql
as $$
declare
  v_digitos text;
begin
  v_digitos := regexp_replace(coalesce(new.telefono, ''), '\D', '', 'g');
  new.telefono_normalizado :=
    case
      when length(v_digitos) = 10 then v_digitos
      when length(v_digitos) = 12 and v_digitos like '52%' then right(v_digitos, 10)
      when length(v_digitos) = 13 and v_digitos like '521%' then right(v_digitos, 10)
      else null
    end;
  return new;
end;
$$;

drop trigger if exists trg_normalizar_telefono_prospecto
on public.prospectos;

create trigger trg_normalizar_telefono_prospecto
before insert or update of telefono
on public.prospectos
for each row
execute function public.normalizar_telefono_prospecto();

-- Backfill: recalcula el normalizado de las filas existentes con
-- la regla nueva (dispara el trigger; seguro con la base actual).
update public.prospectos
set telefono = telefono
where telefono is not null;

notify pgrst, 'reload schema';
