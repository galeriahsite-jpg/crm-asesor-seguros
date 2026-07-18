# Auditoría técnica · CRM LUMO (crm-asesor-seguros)

Reporte de contexto para sincronizar memoria de otro asistente de IA. Generado por revisión completa del código, migraciones SQL y configuración. No se modificó nada. Fecha: 2026-07-18.

---

## 1. Infraestructura y Stack Tecnológico

| Área | Tecnología | Versión |
|---|---|---|
| Framework fullstack | **Next.js (App Router)** | `16.2.10` |
| UI | **React / React DOM** | `19.2.4` |
| Lenguaje | TypeScript (strict) | `^5` |
| Estilos | **Tailwind CSS v4** (vía `@tailwindcss/postcss`, sin `tailwind.config`; tema en CSS con `@theme`) | `^4` |
| BaaS / DB | **Supabase** (`@supabase/supabase-js`) | `^2.110.6` |
| IA | SDK oficial `openai` (usado solo en `/api/lumo-dictado`; las demás rutas llaman a la API por `fetch`) | `^6.48.0` |
| Validación | `zod` está en `package.json` pero **NO se importa en ningún archivo**: toda la validación de `/api/leads` es manual ("equivalente a un leadSchema, sin dependencias") | `^4.4.3` |
| Lint | ESLint 9 + `eslint-config-next` (flat config) | `^9` |

- **Despliegue inferido: Vercel** (referencias explícitas en docs internas a "Vercel → Settings → Environment Variables", deploy vía `git push`).
- **Automatización: n8n local en Docker** (docker-compose, puerto 5678, TZ `America/Mexico_City`).
- `next.config.ts` está vacío (sin config especial). No hay middleware ni carpeta `pages/`.
- Alias de imports: `@/*` → raíz del proyecto.
- `supabaseClient.ts` (raíz): cliente browser con **URL y anon key (publishable) hardcodeadas** — proyecto Supabase `kbvbwuzhtsddqqacdfdb.supabase.co`. Las rutas de servidor usan `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` con esos mismos valores como fallback hardcodeado.
- `AGENTS.md` / `CLAUDE.md`: advierten que esta versión de Next.js tiene breaking changes y que se debe consultar `node_modules/next/dist/docs/` antes de escribir código.
- Docs internas clave: `LUMO_FASE1.md` (visión y activación de LUMO) y `EMBUDO_FLASH.md` (12 correcciones de seguridad del embudo de leads).

## 2. Base de Datos y Supabase

No existe una migración con el esquema base (las tablas principales se crearon fuera del repo); el esquema se infiere del código + 3 migraciones incluidas en `supabase/`.

### Tablas usadas por el código

| Tabla | Propósito | Columnas observadas en el código |
|---|---|---|
| `prospectos` | Leads/prospectos (tabla central) | `id`, `user_id`, `nombre`, `telefono`, `producto`, `estado` (Nuevo/Contactado/Calificado/Sin respuesta/Perdido/Convertido), `nota`, `proxima_accion`, `fecha_proxima`, `cliente_id` (se llena al convertir), `created_at` + columnas del embudo (ver abajo) |
| `clientes` | Clientes activos | `id`, `user_id`, `nombre`, `telefono`, `estado` ('Activo'), `created_at` |
| `citas` | Agenda | `id`, `user_id`, `titulo`, `fecha`, `hora`, `tipo` (Llamada/Videollamada/Visita/Diagnóstico/Seguimiento/Servicio), `estado` (Pendiente/Reprogramada/…), `prospecto_id`, `cliente_id` |
| `oportunidades` | Cotizaciones/ventas | `id`, `user_id`, `cliente` (nombre texto), `producto`, `aseguradora`, `prima`, `estado` ('Cotizando'…), `prospecto_id`, `cliente_id`, `created_at` |
| `polizas` | Pólizas del cliente | `cliente_id` (relación anidada `clientes → polizas(*)`), `vencimiento` (usada para renovaciones a 30 días) |
| `servicios` | Postventa/servicio | `id`, `user_id`, `cliente`, `tipo` (Duda sobre póliza/Cambio de datos/Aclaración de pago/Siniestro/Otro), `descripcion`, `nota`, `estado` ('Reportado'…), `prospecto_id`, `cliente_id` |
| `tramites` | Trámites en curso | `id`, `user_id`, `folio`, `nota`, `estado` (incluye 'Información incompleta', 'Requisito adicional', 'Pago pendiente'), `prospecto_id`, `cliente_id` |
| `diagnosticos` | Diagnósticos de necesidades | `id`, `user_id`, `prospecto_id`, `cliente_id`, `created_at`, más campos propios |
| `aseguradoras` | Directorio de aseguradoras del asesor | `id`, `user_id`, `nombre`, `portal_url`, `usuario`, `ejecutivo`, `telefono` |
| `acciones_ia` | Historial de acciones de LUMO (migración `lumo_migracion.sql`) | `id`, `user_id` (FK a `auth.users` con `on delete cascade`), `texto_original`, `propuesta jsonb`, `confirmadas jsonb`, `resultado` ('ejecutado'/'parcial'/'rechazado'/'error'), `created_at` |
| `web_rate_limits` | Rate limiting servidor (migración `embudo_migracion.sql`) | `clave` (PK, ej. `leads:ip:1.2.3.4`, `ia:user:uuid`, `leads:global`), `contador`, `ventana_inicio` |

### Relaciones clave

- Multi-tenant por asesor: casi todas las tablas llevan `user_id` → `auth.users`.
- `prospectos` es el hub: `citas`, `oportunidades`, `diagnosticos`, `tramites` y `servicios` referencian `prospecto_id` y/o `cliente_id`.
- **Conversión prospecto → cliente**: se inserta el cliente, se re-apuntan (`update … set cliente_id`) las citas, oportunidades, diagnósticos y trámites del prospecto, y el prospecto queda `estado='Convertido'` con `cliente_id` poblado (candado anti-doble conversión).
- `clientes → polizas`: relación 1-N consultada como `select('*, polizas(*)')`.

### Columnas avanzadas / personalizadas en `prospectos` (embudo web)

Añadidas por `embudo_migracion.sql`: `telefono_normalizado` (tel MX a 10 dígitos), `fuente` ('landing'), `campaña`, `utm_source`, `utm_medium`, `utm_campaign`, `consentimiento_contacto` (bool), `consentimiento_contacto_fecha`, `consentimiento_version` (actual: `"2026-07"`), `ultima_solicitud_web`, `nota_entrada_web`. Añadida por `n8n_migracion.sql`: `n8n_procesado timestamptz` (NULL = pendiente de procesar por n8n).

### Índices

- `prospectos_user_fecha_idx` sobre `(user_id, created_at desc)`.
- **`prospectos_user_telefono_unique_idx`: índice ÚNICO parcial sobre `(user_id, telefono_normalizado) where telefono_normalizado is not null`** → deduplicación atómica de leads a nivel BD (los prospectos previos con `telefono_normalizado` NULL quedan fuera).
- `idx_prospectos_n8n_pendientes`: parcial sobre `created_at where n8n_procesado is null and fuente='landing'` (abarata el polling de n8n).
- `acciones_ia_user_fecha` sobre `(user_id, created_at desc)`.

### RLS (políticas en los SQL del repo)

- `prospectos`: RLS habilitado; 4 políticas para rol `authenticated` (select/insert/update/delete) todas con `auth.uid() = user_id`. Se eliminan explícitamente políticas públicas antiguas ("Public can insert leads", "Public access"). El endpoint público inserta con **service_role desde el servidor**, nunca desde el navegador.
- `acciones_ia`: RLS habilitado; select e insert solo de filas propias (`auth.uid() = user_id`).
- `web_rate_limits`: RLS habilitado **sin ninguna política** → solo el service_role (que ignora RLS) puede usarla.
- Función `incrementar_rate_limit(p_clave, p_ventana_segundos)`: `plpgsql`, `security definer`, upsert atómico con ventana deslizante; `REVOKE ALL` a `public/anon/authenticated` (solo service_role la ejecuta).
- Nota: el resto de tablas (`clientes`, `citas`, `oportunidades`, etc.) se asume con RLS equivalente creado fuera del repo; el frontend siempre inserta con `user_id: user.id`.

## 3. Arquitectura de la API (Route Handlers en `app/api/`)

| Ruta | Método | Qué hace | Seguridad / validaciones |
|---|---|---|---|
| `/api/leads` | POST | Recepción pública de leads de todas las landings. Valida, deduplica (upsert `onConflict: 'user_id,telefono_normalizado'` con `ignoreDuplicates`), crea el prospecto a nombre de `LUMO_LEAD_OWNER_ID` con `fuente='landing'`, UTM, consentimiento versionado y `nota_entrada_web`. Si el teléfono ya existía, actualiza SOLO campos seguros (`ultima_solicitud_web`, `nota_entrada_web`), sin tocar estado/notas del asesor. Respuesta `{ok:true}` idéntica exista o no (no filtra información). | Service role solo en servidor; **honeypot** (campo `sitio_web`); cuerpo JSON acotado a 5 KB; nombre 2–80 chars; teléfono MX normalizado (10 dígitos, acepta prefijos 52/521); interés contra catálogo (`Vida, Gastos Médicos, Auto, Hogar, Retiro, Empresas, Referido`); consentimiento obligatorio; UTM truncados a 100 chars; `detalles` extra acotados (máx 15 campos, clave 40 / valor 200 chars) serializados a texto; **rate limit atómico vía RPC** (5/h por IP, 100/h global — falla cerrado con 503 si el limitador no responde); `LUMO_LEAD_OWNER_ID` validado con regex UUID + `auth.admin.getUserById`; todos los errores de Supabase comprobados. Validación manual (sin Zod). |
| `/api/generar-mensaje` | POST | Genera con IA el borrador de primer contacto por WhatsApp para un prospecto. Usa **OpenAI Responses API** (`POST /v1/responses`, modelo `LUMO_MODEL` o `gpt-4o-mini`, `max_output_tokens: 300`). Prompt con reglas estrictas (45–80 palabras, sin inventar precios/coberturas, sin presión). | **NO pública**: exige token Bearer de sesión Supabase y valida el usuario (`auth.getUser`). El navegador solo envía `{prospectoId}` (UUID validado); nombre e interés se leen de la BD **con el token del asesor → RLS garantiza propiedad** (404 si no es suyo). Rate limit 30 mensajes/h por asesor (vía service role; si falta la key, se omite con warning). Salida del modelo validada: rechaza vacía, trunca a 700 caracteres. |
| `/api/lumo` | POST | Intérprete de operaciones: recibe texto libre del asesor + directorio de personas (`{id, nombre, tipo}`, máx 300) y devuelve JSON `{resumen, acciones[]}` con 9 tipos de acción (`crear_prospecto`, `crear_cliente`, `crear_cita`, `definir_proxima_accion`, `crear_oportunidad`, `crear_servicio`, `cambiar_estado`, `registrar_nota`, `generar_mensaje`). Usa Chat Completions (`response_format: json_object`, `temperature: 0.2`), fecha resuelta en TZ `America/Mexico_City`. | Filtra acciones con tipo desconocido (defensa anti-alucinación). Privacidad por diseño: al modelo solo van id/nombre/tipo, nunca teléfonos. ⚠️ **No exige token de sesión** (la ejecución de acciones sí ocurre en el cliente bajo RLS, pero la ruta en sí es invocable sin auth). |
| `/api/lumo-dictado` | POST | Dictáfono: recibe `FormData` con audio (`webm`), transcribe con **Whisper (`whisper-1`)** y extrae datos estructurados con GPT (`OPENAI_MODEL` o `gpt-4o-mini`, JSON: nombre, teléfono, producto, nota, proxima_accion, fecha_proxima). Devuelve `{texto, datos}`. Única ruta que usa el SDK `openai`. | Valida presencia de audio. ⚠️ Sin auth ni rate limit propio; es la ruta más laxa. |

## 4. Frontend y Estructura de Páginas (App Router)

Todas las páginas del CRM son client components (`"use client"`) móvil-first (`max-w-md`), con guard de sesión en el cliente (redirect a `/login` si no hay sesión). No hay middleware de auth en servidor.

### Privadas (CRM — requieren sesión)

| Ruta | Función |
|---|---|
| `/` | **"Hoy"** — dashboard: alertas rojas (prospectos olvidados, trámites atorados), **Centro de decisiones LUMO** (prospectos sin próxima acción, seguimientos vencidos, citas pasadas sin resultado; cada una con razón explicada y botones [Sí, mañana] [Revisar] [Ignorar]), contadores (llamadas pendientes, prospectos activos, renovaciones a 30 días), navegación rápida |
| `/prospectos` | Lista/CRUD de prospectos, cambio de etapa, conversión a cliente |
| `/prospectos/[id]` | Ficha 360° del prospecto (citas, oportunidades, diagnósticos, próxima acción, botón "Mensaje LUMO", conversión a cliente) |
| `/clientes`, `/clientes/[id]` | Lista y expediente de cliente (pólizas anidadas, citas, servicios; `?nuevaPoliza=true` tras conversión) |
| `/agenda` | Citas: crear/editar/reprogramar/cambiar estado |
| `/ventas` | Oportunidades/cotizaciones: pipeline, edición de prima y estado |
| `/servicios` | Tickets de servicio postventa |
| `/tramites` | Trámites con folio y estados de atasco |
| `/diagnosticos` | Diagnósticos de necesidades |
| `/metricas` | Contadores y sumas de primas por estado |
| `/mas` | Ajustes: directorio CRUD de `aseguradoras` (portal, usuario, ejecutivo) |

### Públicas (landings / legal)

- `/login` — email + password (`signInWithPassword`).
- `/solicitud` — landing general del Embudo Flash (formulario propio, no usa `LandingLead`).
- `/cotizar/auto`, `/cotizar/vida`, `/cotizar/retiro`, `/referidos`, `/empresas` — landings por producto construidas con `<LandingLead config={…}>` (server components con `metadata`, campos extra por producto: marca/modelo/año/CP, edad/fumador, afore, empleados, etc.).
- `/aviso-de-privacidad` — aviso legal versionado (v. `2026-07`).

### Componentes reutilizables (`app/components/`)

- **`lumo.tsx`**: sistema base — `Icon` (≈25 iconos SVG stroke propios estilo cuaderno), `BottomNav` (5 tabs: Hoy, Prospectos, Agenda, Ventas, Clientes) y `PageHeader`.
- **`LumoCapture.tsx`**: bandeja universal de captura. Botón flotante azul "+" global (montado en `layout.tsx`, oculto en `/login`, `/solicitud`, `/aviso-de-privacidad`). Flujo: escribir/pegar/dictar (Web Speech API `es-MX`, sin costo de API) → `/api/lumo` → revisión con checkboxes por acción → ejecución en cliente vía Supabase (RLS) → registro best-effort en `acciones_ia` → mensajes generados con botón Copiar / Enviar por WhatsApp (`wa.me`, antepone 52).
- **`LumoDictado.tsx`**: dictáfono con `MediaRecorder` → `/api/lumo-dictado` (Whisper) → tarjeta de confirmación (poka-yoke) → inserta prospecto con próxima acción.
- **`LandingLead.tsx`**: landing configurable (`LandingConfig`: icono, kicker, título, interés fijo o seleccionable, campos extra, bullets). Incluye honeypot invisible, captura UTM de la URL, consentimiento con enlace al aviso, envío a `/api/leads`.

## 5. Sistema de Diseño (UI/UX)

"LUMO Design System" — estética de cuaderno/papel, definida en `globals.css` con Tailwind v4 (`@theme` + `@layer components`):

- **Paleta** (CSS variables): papel crema `--color-paper #F5F1E8`, tarjeta `--color-card #FFFDF8`, tinta `--color-ink #141414` (+ `ink-soft`, `ink-faint`, `linea`), azul foco `#1F3FD8` (+ dark/soft), rojo alerta `#E0342B` (+ dark/soft), verde `#1E7F4F`.
- **Tipografías**: `Instrument Sans` (`--font-sans`) y `Caveat` manuscrita (`--font-hand`, clase `.font-hand` para anotaciones "a mano").
- **Clases de componentes**: `.lumo-card` (tarjeta blanca), `.lumo-lines` (renglones de cuaderno), `.lumo-input`, `.lumo-btn-primary` / `-danger` / `-ghost`, `.lumo-chip` (+ variantes `-azul`, `-rojo`, `-negro`), `.lumo-tape` (cinta adhesiva roja decorativa), `.lumo-section-title`, `.lumo-underline` (subrayado azul manuscrito).
- Fondo con textura de papel sutil (radial-gradient punteado), scrollbar oculta, layout móvil `max-w-md mx-auto` con `BottomNav` fija.

## 6. Integraciones Externas y Automatización

### OpenAI

- **Whisper (`whisper-1`)**: transcripción de audio en `/api/lumo-dictado` (SDK oficial).
- **Chat Completions** (`gpt-4o-mini` por defecto; configurable con `LUMO_MODEL` / `OPENAI_MODEL`): interpretación de texto a acciones (`/api/lumo`) y extracción de datos del dictado (`/api/lumo-dictado`), ambos con `response_format: json_object`.
- **Responses API** (`/v1/responses`): generación del mensaje de primer contacto (`/api/generar-mensaje`).
- La API key vive solo en servidor. Privacidad por diseño: nunca se envían teléfonos/pólizas al modelo desde `LumoCapture`.

### n8n (carpeta `n8n/`, corre local en Docker, puerto 5678)

1. **`flujo-leads-automatico.json`** (principal): Schedule Trigger cada 2 min → Config (set: `supabase_url`, `service_key`, `whatsapp_phone`, `callmebot_apikey`) → GET `rest/v1/prospectos?fuente=eq.landing&n8n_procesado=is.null&limit=20` (headers service_role) → nodo Code con mapa producto→aseguradoras (Auto: AXA/HDI/ABA/GNP; Vida: GNP/MetLife/AXA; GM: GNP/AXA/MetLife; Hogar: AXA/HDI/GNP; Retiro: Profuturo/MetLife; Empresas: GNP/MetLife/AXA; Referido: GNP/AXA) → POST a `rest/v1/oportunidades` (estado 'Cotizando' por aseguradora) → aviso WhatsApp vía **CallMeBot** (`api.callmebot.com/whatsapp.php`, con nombre, teléfono, `nota_entrada_web` y links de cotización) → PATCH `n8n_procesado=now()` para no reprocesar.
2. **`flujo-cotizaciones.json`**: Webhook `POST /webhook/cotizar` con `{prospecto_id, producto}` → busca el prospecto → crea 6 oportunidades 'Cotizando' (AXA, HDI, ABA, GNP, MetLife, Profuturo) → responde con links directos de cotización.
- Las credenciales van en el nodo Config de cada flujo (placeholders en el repo; la service_role real solo vive en el n8n local).
- Limitación documentada: las aseguradoras no tienen API pública de cotización (formularios con captcha), por eso el flujo registra la cotización pendiente + links, no cotiza automáticamente.

### Otras

- **CallMeBot**: WhatsApp gratuito de notificación al propio asesor (requiere apikey por mensaje de activación).
- **WhatsApp `wa.me`**: deep links para enviar los mensajes generados (frontend).
- **Google Fonts**: Instrument Sans + Caveat vía `@import` en CSS.

## 7. Variables de Entorno Requeridas (solo nombres)

| Variable | Uso |
|---|---|
| `OPENAI_API_KEY` | Todas las rutas de IA (obligatoria) |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/leads` (obligatoria) y rate limit de `/api/generar-mensaje`; solo servidor |
| `LUMO_LEAD_OWNER_ID` | UUID del asesor dueño de los leads del embudo (obligatoria para `/api/leads`) |
| `LUMO_MODEL` | Opcional; modelo para `/api/lumo` y `/api/generar-mensaje` (default `gpt-4o-mini`) |
| `OPENAI_MODEL` | Opcional; modelo para `/api/lumo-dictado` (default `gpt-4o-mini`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Opcional en servidor (tiene fallback hardcodeado); no usada por el cliente browser (hardcodeado en `supabaseClient.ts`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ídem anterior |

## 8. Resumen de Funcionalidades Clave del CRM

- **LUMO Captura Universal**: botón flotante "+" global; texto/pegado/dictado en lenguaje natural → IA propone acciones estructuradas → el asesor revisa checkbox por checkbox y confirma → se ejecutan bajo su sesión (RLS) → historial en `acciones_ia` (explicabilidad + auditoría).
- **Centro de Decisiones en "Hoy"**: regla "ningún prospecto sin próxima acción" — detecta prospectos sin siguiente paso, seguimientos vencidos y citas pasadas sin resultado; cada sugerencia trae su razón y botones de un toque.
- **Dictáfono Inteligente**: nota de voz → Whisper → extracción estructurada → tarjeta de confirmación antes de guardar.
- **Poka-Yoke de conversión prospecto → cliente**: bloqueo si ya fue convertido (`cliente_id` presente); al convertir migra automáticamente citas, oportunidades, diagnósticos y trámites al nuevo cliente, marca 'Convertido', agenda revisión postventa + petición de referidos a 15 días y redirige al expediente para capturar la póliza.
- **Embudo Flash seguro**: 6 landings públicas por producto con honeypot, rate limiting atómico en BD, deduplicación por índice único parcial, atribución UTM completa, consentimiento versionado y respuesta que no filtra existencia de registros.
- **Mensaje LUMO de primer contacto**: borrador IA autenticado y limitado (30/h), siempre editable por el asesor antes de copiar/enviar por WhatsApp.
- **Automatización n8n**: leads nuevos → oportunidades 'Cotizando' por aseguradora según producto + aviso WhatsApp al asesor con links de cotización; marca `n8n_procesado` para idempotencia.
- **Gestión completa del ciclo**: prospectos → diagnósticos → oportunidades → conversión → pólizas (con alerta de renovaciones a 30 días) → servicios y trámites (con detección de atascos) → métricas.
- **Multi-tenant por asesor** vía `user_id` + RLS en toda la base.

### Observaciones de riesgo detectadas (para contexto, no se modificó nada)

1. `/api/lumo` y `/api/lumo-dictado` no exigen sesión (exposición de costo de API de OpenAI si se descubren las URLs).
2. URL y anon key de Supabase hardcodeadas en `supabaseClient.ts` (aceptable por ser publishable, pero inconsistente con el uso de env vars en servidor).
3. La conversión prospecto→cliente hace múltiples updates sin transacción (riesgo de migración parcial si falla a medias).
4. Auth solo en cliente (sin middleware/SSR guard); la protección real de datos recae en RLS.
5. `zod` instalado pero sin uso.
