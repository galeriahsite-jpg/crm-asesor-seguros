-- ============================================================
-- LUMO · Normalización automática de teléfono en prospectos
-- APLICADO EN PRODUCCIÓN: 2026-07-18 (manual, SQL Editor)
--
-- Qué hace: cada vez que se inserta o actualiza el teléfono de
-- un prospecto (venga de landing, captura manual, dictado o
-- LumoCapture), el trigger calcula `telefono_normalizado`
-- (últimos 10 dígitos) para que la deduplicación por índice
-- único (user_id, telefono_normalizado) cubra TODAS las vías
-- de entrada, no solo la API de leads.
--
-- Prerequisito (ya cumplido): cero duplicados de teléfono por
-- usuario. Verificación:
--   select user_id, right(regexp_replace(telefono,'\D','','g'),10),
--          count(*) from prospectos where telefono is not null
--   group by 1,2 having count(*) > 1;
-- ============================================================

create or replace function public.normalizar_telefono_prospecto()
returns trigger
language plpgsql
as $$
declare
  v_digitos text;
begin
  v_digitos := regexp_replace(coalesce(new.telefono, ''), '\D', '', 'g');
  if length(v_digitos) > 10 then
    v_digitos := right(v_digitos, 10);
  end if;
  new.telefono_normalizado :=
    case
      when length(v_digitos) = 10 then v_digitos
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

-- Backfill: dispara el trigger sobre las filas existentes.
-- (UPDATE OF telefono se dispara aunque el valor no cambie.)
update public.prospectos
set telefono = telefono
where telefono is not null;

notify pgrst, 'reload schema';
