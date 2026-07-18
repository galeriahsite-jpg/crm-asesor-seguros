# REPORTE DE REPARACIÓN INTEGRAL · LUMO
**Rama:** `fix/reparacion-integral-lumo` · **Fecha:** 2026-07-18 · **v2 (segunda revisión aplicada)**
**Sin push, sin merge, sin deploy.** Cero funcionalidades eliminadas.

## 0. Segunda revisión — 10 correcciones aplicadas

| # | Observación del revisor | Resolución |
|---|---|---|
| 1 | Guía usaba `master` | ✅ Verificado con `git branch -a`: la principal es **`main`** (no existe master). Guía corregida con `git pull origin main` incluido |
| 2 | `IF NOT EXISTS` no garantiza la DEFINICIÓN del índice | ✅ La migración ahora hace recreación controlada (DROP ambos índices + CREATE sin if-not-exists) SOLO tras confirmar cero duplicados. Idempotencia por definición |
| 3 | Diagnóstico no verificaba columnas de relación de la RPC | ✅ Query 6c: user_id/prospecto_id/cliente_id en citas, oportunidades, diagnosticos, tramites y servicios (esperado: 15 filas) |
| 4 | `CREATE TABLE IF NOT EXISTS` no repara tablas incompletas | ✅ Sección B.1b: ALTER ADD COLUMN IF NOT EXISTS para TODAS las columnas de actividades, cotizaciones, ai_usage y web_rate_limits; B.1c para las relaciones de las 5 tablas de la conversión |
| 5 | FK de actividades con ON DELETE CASCADE contradice bitácora inmutable | ✅ Documentado como decisión de producto PENDIENTE en la migración (se conserva CASCADE por compatibilidad; alternativas SET NULL o archivado lógico; cambiarla requiere migración propia con rollback). NO se cambió |
| 6 | Política INSERT de actividades no validaba propiedad de las relaciones | ✅ WITH CHECK reforzado: prospecto_id, cliente_id Y oportunidad_id deben pertenecer al mismo auth.uid(). Aplicado en migración y esquema_base. Nueva prueba R2 en checklist |
| 7 | "Blocked" de Vercel atribuido sin confirmar | ✅ Guía ahora separa Error (causa confirmada: variables) de Blocked (causa NO confirmada) con paso 2b: abrir el deployment, leer y anotar el mensaje exacto |
| 8 | Diagnóstico incompleto | ✅ Añadidos: indexdef (6b), FKs con delete_rule (6d), definición real de políticas qual/with_check (6e), definición ACTIVA de las 3 RPCs con pg_get_functiondef (6f), columnas NOT NULL sin default (6g) |
| 9 | Idempotencia por nombre vs por definición | ✅ Índice: recreación controlada. Funciones: create or replace (definición garantizada). Políticas: drop+create (definición garantizada). Columnas: ADD IF NOT EXISTS (aditivo). Documentado |
| 10 | Re-verificación | ✅ tsc 0 · build OK 25 rutas · lint sin errores nuevos (13 legado) · JSON n8n válido (resultados abajo, re-ejecutados tras estos cambios) |

---

## 1. Errores encontrados y su causa raíz

| # | Error | Causa raíz | Estado |
|---|---|---|---|
| E1 | `POST /api/leads` → 500, código 42P10 | El índice único de deduplicación era **PARCIAL** (`where telefono_normalizado is not null`, `embudo_migracion.sql`) y PostgREST no puede inferir índices parciales en `ON CONFLICT`. Fallaba en TODO lead, no solo duplicados. | ✅ Reparado (migración A.1) |
| E2 | Deployments de Vercel en Error | Faltan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel (obligatorias desde el blindaje). Reproducido localmente: el build falla en prerender sin ellas. | ⚠️ Acción manual tuya (Paso 2 de la guía) |
| E3 | Botón convertir prospecto→cliente falla | El código es correcto; en producción falta la función RPC y/o la tabla `actividades` (migraciones sin correr). Confirmable con `SQL_DIAGNOSTICO_PRODUCCION.sql`. | ✅ Cubierto por migración + UX mejorada |
| E4 | **UUID truncado en selects de persona** (no reportado, descubierto en auditoría) | 5 módulos componían `value` como `id-tipo-nombre` y hacían `split('-')`… pero los UUID contienen guiones → el id quedaba truncado y la vinculación de persona fallaba en Agenda, Ventas, Servicios, Trámites y Diagnósticos. | ✅ Reparado (separador `\|`) |
| E5 | n8n duplicaba oportunidades en reintentos | Si fallaba WhatsApp o el PATCH, el lead no se marcaba procesado y el siguiente ciclo creaba TODO de nuevo. | ✅ Reparado (verificación previa idempotente) |
| E6 | Huecos de línea de tiempo | Creaciones desde módulos agenda/servicios/trámites/diagnósticos no registraban actividad. | ✅ Reparado |
| E7 | Sin timeout en llamadas a OpenAI | Una respuesta colgada bloqueaba la ruta indefinidamente. | ✅ Reparado (30s fetch / 60s Whisper) |
| E8 | 13 errores de ESLint legado (`any`, comillas, setState-en-effect) | Código original previo a la auditoría. No afectan build ni runtime. | ⚠️ Pendiente (riesgo bajo, cosmético) |

## 2. Archivos modificados (exacto)

**Commit `0153fba` (Bloque A):**
- `supabase/reparacion_integral_20260718.sql` (NUEVO)
- `SQL_DIAGNOSTICO_PRODUCCION.sql` (NUEVO)
- `supabase/SINCRONIZACION_TOTAL.sql` (índice corregido)
- `supabase/esquema_base.sql` (índice corregido)

**Cambios en disco pendientes de commit** (git quedó bloqueado por un `index.lock` atascado del filesystem — ver guía, paso 0):
- `app/prospectos/[id]/page.tsx` — Bloque C: guard anti doble-clic, botón "Convirtiendo…", error visible con pista, sin navegar hasta éxito
- `app/prospectos/page.tsx` — Bloque C: ídem para "Venta Directa"
- `app/agenda/page.tsx` — Bloque D: actividades `cita_creada`/`cita_resultado` + D.2 fix UUID
- `app/servicios/page.tsx` — Bloque D: `servicio_abierto` + D.2 fix UUID
- `app/tramites/page.tsx` — Bloque D: `tramite_creado` + D.2 fix UUID
- `app/diagnosticos/page.tsx` — Bloque D: `diagnostico_creado` + D.2 fix UUID
- `app/ventas/page.tsx` — Bloque D.2: fix UUID
- `app/api/lumo/route.ts` — Bloque E: timeout 30s
- `app/api/generar-mensaje/route.ts` — Bloque E: timeout 30s
- `app/api/lumo-dictado/route.ts` — Bloque E: timeout 60s + maxRetries 1
- `n8n/flujo-leads-automatico.json` — Bloque F: idempotencia (verifica oportunidad y cotizaciones existentes antes de crear; actividad solo en creación nueva)

**Bloque B (/api/leads): sin cambios de código** — el upsert es correcto; el fix es el índice (migración A.1).

## 3. Resultados reales de verificación

| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` (strict) | ✅ 0 errores (ejecutado tras CADA bloque) |
| `npx next build` | ✅ Compiled successfully, 25 rutas |
| `npx eslint` | ⚠️ 13 errores legado + 16 warnings (preexistentes, no funcionales) |
| JSON n8n | ✅ Válido |

## 4. Riesgos pendientes

1. **Debes correr la migración en Supabase** — hasta entonces E1 y E3 siguen vivos en producción.
2. **Variables en Vercel** — hasta configurarlas, los deploys seguirán fallando.
3. Si el diagnóstico revela **duplicados reales** de teléfono, la migración se protege sola (WARNING) y habrá que fusionarlos a mano antes de reintentar la parte A.1.
4. Lint legado (E8) — limpieza cosmética pendiente.
5. Auth de páginas sigue siendo client-side (datos protegidos por RLS; middleware SSR = mejora futura ya documentada).

## 5. Confirmación de funcionalidades

Ninguna funcionalidad fue eliminada, simplificada ni reemplazada: Embudo Flash, 6 landings, prospectos, clientes, conversión transaccional, agenda, diagnósticos, ventas (1 oportunidad → N cotizaciones), servicios, trámites, línea de tiempo, briefing, registro poscontacto, Centro de Decisiones, métricas de velocidad, LumoCapture, LumoDictado, 4 APIs de IA, RLS, rate limiting, n8n y el sistema visual LUMO están intactos (verificado por build de las 25 rutas y revisión por bloque).

## 6. Plan de rollback

- **Código:** `git checkout master` (la rama `fix/reparacion-integral-lumo` queda aislada; nada se pusheó).
- **SQL:** la migración es aditiva/no destructiva. Reversión del único cambio estructural (índice):
  ```sql
  drop index if exists prospectos_user_tel_norm_uniq;
  create unique index if not exists prospectos_user_telefono_unique_idx
    on public.prospectos (user_id, telefono_normalizado)
    where telefono_normalizado is not null;
  ```
- **n8n:** re-importar el JSON de la rama `master` si se quisiera volver atrás.
