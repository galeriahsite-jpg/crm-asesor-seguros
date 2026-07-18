# LUMO · Blindaje + Reestructura de oportunidades — Guía de activación

Cambios implementados según la hoja de ruta de `AUDITORIA_LUMO_CANONICA.md`
(fase inmediata completa + reestructura oportunidad → cotizaciones).
Fecha: 2026-07-18.

## Qué cambió

### Seguridad (riesgos críticos 1 y 2, altos 3–10)

1. **`/api/lumo` y `/api/lumo-dictado` ya NO son públicas.** Exigen token Bearer
   de sesión Supabase, tienen rate limit por asesor (30 interpretaciones/h,
   20 dictados/h) y el dictado valida tipo MIME y tamaño máximo (10 MB).
   `LumoCapture` y `LumoDictado` ya envían el token automáticamente.
2. **Conversión prospecto → cliente ahora es transaccional.** Nueva función SQL
   `convertir_prospecto_a_cliente(uuid)`: o migra todo (cliente + citas +
   oportunidades + diagnósticos + trámites + servicios + sellado) o nada.
   Ambas pantallas de prospectos ya la usan vía RPC.
3. **Sin claves hardcodeadas.** `supabaseClient.ts` y todas las rutas leen de
   variables de entorno. Nuevos archivos: `.env.example` (plantilla, se sube a
   git) y `.env.local` (tus valores locales, ignorado por git).
4. **Validación estandarizada con Zod** en las 4 rutas de API (entrada y, en el
   dictado, también la salida del modelo).
5. **RLS explícito en TODAS las tablas** (antes solo 3 tenían políticas en el
   repo): `blindaje_migracion.sql` las crea para clientes, citas, oportunidades,
   pólizas, servicios, trámites, diagnósticos y aseguradoras.
6. **Esquema base reproducible**: `supabase/esquema_base.sql` recrea la base
   completa desde cero (staging/recuperación).
7. **Monitoreo de IA**: tabla `ai_usage` registra ruta, modelo, tokens, duración
   y éxito de cada llamada (consultable por asesor).

### Modelo de ventas (sección 14 de la auditoría)

- Nueva tabla **`cotizaciones`** anidada a `oportunidades`.
- **1 lead = 1 oportunidad** ("Por diagnosticar") con N cotizaciones
  "Pendiente" por aseguradora — ya no 2–6 oportunidades artificiales.
- Página **Ventas** rediseñada: crea oportunidades, agrega cotizaciones por
  aseguradora dentro de cada una, captura primas (pasa sola a "Cotizada"),
  marca Elegida/Descartada. Las oportunidades viejas se muestran como
  "Registro anterior" y siguen editables.
- **LumoCapture** (`crear_oportunidad`) y **ambos flujos n8n** actualizados al
  modelo nuevo.
- Bug corregido de paso: los imports rotos de `LandingLead` en `/empresas` y
  `/referidos` (rutas relativas) ya compilan.

## Pasos para activar (EN ESTE ORDEN)

### 1. Migración en Supabase (obligatoria ANTES del deploy)
Dashboard → SQL Editor → New query → pega `supabase/blindaje_migracion.sql` → Run.

⚠️ Antes de correrla, ejecuta el query de "huérfanos" comentado dentro del
archivo (sección 1): si alguna tabla tiene filas con `user_id` NULL, repáralas
primero o dejarán de ser visibles al activar RLS.

Opcional: la sección 3b (comentada) consolida las oportunidades viejas
duplicadas de n8n. Haz backup antes si decides correrla.

### 2. Variables de entorno en Vercel (obligatorio ANTES del deploy)
Settings → Environment Variables. Además de las que ya tienes
(`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LUMO_LEAD_OWNER_ID`), ahora
son OBLIGATORIAS (antes estaban hardcodeadas):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kbvbwuzhtsddqqacdfdb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu clave publishable (la que estaba en `supabaseClient.ts`) |

Sin ellas el build de Vercel falla con un mensaje claro.

### 3. Deploy
`git add . && git commit -m "Blindaje + cotizaciones anidadas" && git push`

### 4. Re-importar los flujos de n8n
Los dos JSON cambiaron. En n8n: borra (o desactiva) los flujos viejos →
Import from File → `flujo-leads-automatico.json` y `flujo-cotizaciones.json` →
vuelve a llenar el nodo **Config** de cada uno (url, service key, teléfono,
apikey CallMeBot) → activa.

### 5. Probar
- Entra a la app → botón "+" → dicta algo → debe funcionar igual que antes
  (ahora autenticado). En una ventana de incógnito, `curl -X POST tudominio/api/lumo`
  debe responder 401.
- Convierte un prospecto de prueba → verifica que cliente e historial migran.
- Llena una landing → en ~2 min: 1 oportunidad "Por diagnosticar" con sus
  cotizaciones en Ventas + WhatsApp.
- Consumo de IA: Supabase → Table Editor → `ai_usage`.

## Pendientes conocidos (fuera de este cambio)

- CallMeBot sigue como notificador (paso 9 de la hoja de ruta pide migrar a
  WhatsApp Cloud API/Twilio — requiere contratar el servicio).
- Auth sigue siendo client-side en las páginas (riesgo alto 4: middleware/SSR
  pendiente; los datos ya están protegidos por RLS).
- Los avisos de lint preexistentes en páginas viejas (`any`, comillas sin
  escapar) no bloquean el build; limpiarlos es cosmético.
- En tu Mac, si quieres, borra las carpetas `node_modules/@next/swc-linux-*` y
  `swc-win32-*` (binarios de otras plataformas que se instalaron al verificar
  el build en el sandbox; son inofensivos y git los ignora).

## Verificación realizada

- `tsc --noEmit` (strict): sin errores.
- `next build`: compila y genera las 25 rutas.
- ESLint: sin errores nuevos en los archivos modificados.
- JSON de n8n validados sintácticamente.
