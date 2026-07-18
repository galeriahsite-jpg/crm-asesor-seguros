-- ============================================================
-- LUMO · Normalización de teléfono en CLIENTES
-- PENDIENTE DE APLICAR (correr manualmente en SQL Editor,
-- después de trigger_normalizar_telefono_v2.sql).
--
-- Cierra el círculo: el trigger de prospectos no cubre la tabla
-- clientes (los triggers son por tabla). Misma regla única:
--   válido = 10 dígitos, o 12 con prefijo 52, o 13 con 521.
--
-- NOTA: aquí NO se crea índice único de deduplicación. A
-- diferencia de prospectos, dos clientes legítimos pueden
-- compartir teléfono (cónyuges, empresa familiar) y la
-- conversión prospecto→cliente no debe fallar por eso.
-- La columna normalizada sirve para búsquedas y consistencia.
--
-- Idempotente. Rollback:
--   drop trigger if exists trg_normalizar_telefono_cliente on public.clientes;
--   drop function if exists public.normalizar_telefono_cliente();
--   alter table public.clientes drop column if exists telefono_normalizado;
-- ============================================================

alter table public.clientes
  add column if not exists telefono_normalizado text;

create or replace function public.normalizar_telefono_cliente()
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

drop trigger if exists trg_normalizar_telefono_cliente
on public.clientes;

create trigger trg_normalizar_telefono_cliente
before insert or update of telefono
on public.clientes
for each row
execute function public.normalizar_telefono_cliente();

-- Backfill de clientes existentes.
update public.clientes
set telefono = telefono
where telefono is not null;

notify pgrst, 'reload schema';
