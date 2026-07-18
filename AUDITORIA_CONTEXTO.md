# Auditoría técnica · CRM LUMO (crm-asesor-seguros) — v2 ACTUALIZADA

Reporte de contexto para sincronizar memoria de otro asistente de IA. Refleja el
estado del código DESPUÉS de: blindaje de seguridad, reestructura de oportunidades,
y fase operativa (línea de tiempo, briefing, post-llamada, motor de decisiones,
velocidad de respuesta). Documentos de referencia en el repo: `ENFOQUE_LUMO.md`
(definición de producto y niveles de autonomía), `AUDITORIA_LUMO_CANONICA.md`
(estrategia), `MEJORAS_BLINDAJE.md` y `MEJORAS_OPERATIVA.md` (guías de activación).
Fecha: 2026-07-18.

---

## 1. Infraestructura y Stack Tecnológico

| Área | Tecnología | Versión |
|---|---|---|
| Framework fullstack | **Next.js (App Router)** | `16.2.10` |
| UI | **React / React DOM** | `19.2.4` |
| Lenguaje | TypeScript (strict) | `^5` |
| Estilos | **Tailwind CSS v4** (`@tailwindcss/postcss`, tema en CSS con `@theme`, sin tailwind.config) | `^4` |
| BaaS / DB | **Supabase** (`@supabase/supabase-js`) | `^2.110.6` |
| IA | SDK `openai` (solo en `/api/lumo-dictado`; el resto vía `fetch`) | `^6.48.0` |
| Validación | **Zod — ahora SÍ usado en las 4 rutas de API** | `^4.4.3` |
| Lint | ESLint 9 + `eslint-config-next` (flat config) | `^9` |

- **Despliegue: Vercel** (frontend + Route Handlers) y Supabase Cloud (DB).
- **Automatización: n8n local en Docker** (puerto 5678, TZ America/Mexico_City).
- **Config por variables de entorno** (ya NO hay claves hardcodeadas):
  `supabaseClient.ts` lee `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
  y lanza error claro si faltan. Existen `.env.example` (commiteado) y `.env.local`
  (gitignored). `.gitignore` tiene `!.env.example`.
- Helper compartido de servidor: **`app/api/_lib/servidor.ts`** exporta
  `configSupabase()`, `clienteAdmin()`, `autenticar(request)` (Bearer → user +
  cliente bajo RLS), `limitarUso(clave, límite, ventana, msg)` (RPC atómico) y
  `registrarUsoIA(...)` (inserta en `ai_usage`, best effort).
- Helper cliente: **`app/lib/actividades.ts`** — `registrarActividad()`,
  `sellarPrimerContacto()`, `tiempoTranscurrido()`, `ETIQUETAS_ACTIVIDAD`,
  tipos `TipoActividad`/`Actividad`.
- Alias `@/*` → raíz. `next.config.ts` vacío. Sin middleware (auth de páginas
  sigue siendo client-side; los datos los protege RLS).

## 2. Base de Datos y Supabase

### Migraciones (correr EN ORDEN sobre la base existente)
1. `supabase/embudo_migracion.sql` — columnas de embudo, RLS de prospectos, índice único, rate limits.
2. `supabase/lumo_migracion.sql` — `acciones_ia`.
3. `supabase/n8n_migracion.sql` — `n8n_procesado`.
4. `supabase/blindaje_migracion.sql` — RLS en TODAS las tablas, RPC conversión, `cotizaciones`, `ai_usage`.
5. `supabase/operativa_migracion.sql` — `actividades`, `primer_contacto_at`, RPC conversión v2.

**`supabase/esquema_base.sql`**: esquema COMPLETO reproducible desde cero
(tablas + FKs + índices + RLS + funciones; equivale a las 5 migraciones). Para
staging/recuperación; no correr en producción existente.

### Tablas

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `prospectos` | Hub central | `id, user_id, nombre, telefono, producto, estado (Nuevo/Contactado/Calificado/Sin respuesta/Perdido/Convertido), nota, proxima_accion, fecha_proxima, cliente_id` + embudo: `telefono_normalizado, fuente, campaña, utm_source/medium/campaign, consentimiento_contacto(+fecha,+version), ultima_solicitud_web, nota_entrada_web` + `n8n_procesado` + **`primer_contacto_at, primer_contacto_canal`** (speed-to-lead) |
| `clientes` | Cartera | `id, user_id, nombre, telefono, estado('Activo')` |
| `polizas` | Referencias comerciales (no documentos legales) | `cliente_id, aseguradora, numero_poliza, producto, vencimiento, estado` |
| `citas` | Agenda | `titulo, fecha, hora, tipo(Llamada/Videollamada/Visita/Diagnóstico/Seguimiento/Servicio/Renovación), estado(Pendiente/Reprogramada/…), prospecto_id, cliente_id` |
| `oportunidades` | **1 intención comercial por persona/producto** | `cliente(texto), producto, estado('Por diagnosticar'/'Cotizando'/'Propuesta presentada'/…/Ganada/Perdida), prospecto_id, cliente_id` + `aseguradora, prima` (LEGADO: en el modelo nuevo viven en cotizaciones) |
| **`cotizaciones`** (nueva) | Alternativas por aseguradora anidadas | `oportunidad_id (FK cascade), aseguradora, prima, estado(Pendiente/Cotizada/Presentada/Elegida/Descartada), nota, url_cotizador, user_id` |
| `servicios` | Postventa | `cliente, tipo, descripcion, nota, estado('Reportado'…), prospecto_id, cliente_id` |
| `tramites` | Trámites | `cliente, folio, nota, estado (incl. 'Información incompleta','Requisito adicional','Pago pendiente')` |
| `diagnosticos` | 6 preguntas de descubrimiento | `que_proteger, riesgo_preocupante, producto_posible, aseguradoras_consultar, fecha_decision, nota, producto_sugerido, prospecto_id, cliente_id` |
| `aseguradoras` | Directorio del asesor | `nombre, portal_url, usuario, ejecutivo, telefono` |
| `acciones_ia` | Auditoría de LUMO Captura | `texto_original, propuesta jsonb, confirmadas jsonb, resultado` |
| **`actividades`** (nueva) | **Línea de tiempo universal** | `user_id, prospecto_id, cliente_id, oportunidad_id, tipo, descripcion, metadata jsonb, created_at`. Tipos: `lead_recibido, prospecto_creado, cliente_creado, proxima_accion_definida, contacto_whatsapp, contacto_llamada, mensaje_generado, resultado_contacto, cita_creada, cita_resultado, diagnostico_creado, oportunidad_creada, cotizacion_agregada, etapa_cambiada, nota_registrada, convertido, poliza_registrada, servicio_abierto, tramite_creado, renovacion_contactada, secuencia_enviada`. **Inmutable desde la app** (RLS: solo select+insert) |
| **`ai_usage`** (nueva) | Monitoreo de IA | `user_id, route, model, input_tokens, output_tokens, duration_ms, success` (inserta solo service role; el asesor lee lo suyo) |
| `web_rate_limits` | Rate limiting atómico | `clave (PK), contador, ventana_inicio` (sin políticas → solo service role) |

### Funciones SQL
- `incrementar_rate_limit(p_clave, p_ventana_segundos)` — security definer,
  upsert atómico con ventana deslizante; revocada a public/anon/authenticated.
- **`convertir_prospecto_a_cliente(p_prospecto_id) returns uuid`** — security
  invoker (RLS aplica), `select … for update`, candado anti-doble conversión;
  crea cliente, migra citas/oportunidades/diagnosticos/tramites/servicios,
  sella prospecto (Convertido + postventa a 15 días) **y registra la actividad
  'convertido'** — todo en UNA transacción.
- **`sellar_primer_contacto(p_prospecto_id, p_canal)`** — idempotente: solo
  escribe si `primer_contacto_at` es NULL.

### Índices clave
`prospectos_user_telefono_unique_idx` (ÚNICO parcial `user_id+telefono_normalizado`,
dedupe atómico), `idx_prospectos_n8n_pendientes`, **`idx_prospectos_sin_contacto`**
(parcial: `primer_contacto_at is null and estado='Nuevo'`), `cotizaciones_oportunidad_idx`,
`actividades_prospecto_idx` / `actividades_cliente_idx` (con `created_at desc`).

### RLS
**TODAS** las tablas operativas (prospectos, clientes, citas, oportunidades,
cotizaciones, polizas, servicios, tramites, diagnosticos, aseguradoras) tienen
el patrón completo select/insert/update/delete con `auth.uid() = user_id`
(bloque `do $$` en blindaje_migracion). `acciones_ia` y `actividades`: solo
select+insert propias. `web_rate_limits` y `ai_usage`: sin insert para
authenticated (solo service role; ai_usage permite select propio).

## 3. Arquitectura de la API (`app/api/`)

Todas usan Zod y el helper `_lib/servidor.ts`. **Ya no hay rutas de IA públicas.**

| Ruta | Auth | Qué hace | Protecciones |
|---|---|---|---|
| `/api/leads` POST | Pública (por diseño) | Recibe leads de landings: valida (Zod: honeypot `sitio_web` literal '', nombre 2–80, tel MX normalizado 10 díg. con prefijos 52/521, interés en catálogo, consentimiento literal true, UTM ≤100c, detalles ≤15 campos), upsert `onConflict user_id,telefono_normalizado` + `ignoreDuplicates`; duplicado → solo actualiza `ultima_solicitud_web/nota_entrada_web`; **registra actividad `lead_recibido`** (con UTM en metadata; también en duplicados). Respuesta `{ok:true}` idéntica exista o no | service role solo servidor; cuerpo ≤5KB; rate limit atómico 5/h IP + 100/h global (falla cerrado 503); `LUMO_LEAD_OWNER_ID` regex UUID + `auth.admin.getUserById` |
| `/api/lumo` POST | **Bearer obligatorio** | Texto libre + directorio (máx 300 personas `{id uuid, nombre ≤120, tipo}`) → Chat Completions (`json_object`, temp 0.2) → `{resumen, acciones[]}` con 9 tipos; filtra tipos desconocidos | Rate limit 30/h por asesor; texto ≤4000c (Zod); privacidad: sin teléfonos al modelo; log en `ai_usage` |
| `/api/lumo-dictado` POST | **Bearer obligatorio** | FormData audio → Whisper (`whisper-1`, language es) → GPT extrae JSON (nombre/telefono/producto/nota/proxima_accion/fecha_proxima) **validado con Zod** (fallback: texto como nota) → `{texto, datos}` | Rate limit 20/h; audio ≤10MB, MIME whitelist, no vacío; log en `ai_usage` |
| `/api/generar-mensaje` POST | **Bearer obligatorio** | `{prospectoId}` (Zod uuid) → lee nombre/producto BAJO RLS del asesor → Responses API (`/v1/responses`, `max_output_tokens 300`) → borrador WhatsApp 45–80 palabras, sin inventar precios | Rate limit 30/h; salida validada (no vacía, ≤700c); 404 idéntico si no existe/no es suyo; log en `ai_usage` |

Modelos: `LUMO_MODEL` / `OPENAI_MODEL` (default `gpt-4o-mini`).

## 4. Frontend y Estructura de Páginas (App Router)

Client components móvil-first (`max-w-md`), guard de sesión client-side, RLS
protege datos.

### Privadas (CRM)
| Ruta | Función |
|---|---|
| `/` "Hoy" | Alertas (prospectos olvidados, trámites atorados) + **Motor de siguiente mejor acción**: 6 reglas con razón explicada y resolución de 1 toque — ⚡ leads Nuevo sin `primer_contacto_at` (urgente, con tiempo transcurrido, botones [Abrir ficha][Ya lo contacté]), prospectos sin próxima acción, seguimientos vencidos, citas pasadas sin resultado, renovaciones ≤30 días ([Agendar llamada] crea cita mañana 10:00 + actividad), trámites atorados ([Agendar revisión] crea cita). Urgentes primero, máx 10 |
| `/prospectos` | CRUD + etapas (log `etapa_cambiada`), WhatsApp (log + sella primer contacto), conversión vía RPC |
| `/prospectos/[id]` Ficha 360° | **Briefing "Antes de contactar"** (interés/etapa, último movimiento, promesa pendiente, próxima cita, nota web, objetivo sugerido por reglas: primer contacto→diagnóstico→cotización→cierre) · **Registro post-llamada de 1 toque** (5 resultados con efectos: Respondió·interesado→Contactado+seguimiento mañana; Quiere cotización→Calificado+preparar cotización; No respondió→reintentar mañana; Pidió tiempo→retomar en 3 días; No interesado→Perdido; todo con actividad y sellado de primer contacto) · **Línea de Tiempo** (últimas 30 actividades) · citas, diagnóstico 6 preguntas, cotizar (crea oportunidad+cotización anidada), Mensaje LUMO, conversión RPC |
| `/clientes`, `/clientes/[id]` | Expediente: pólizas (`?nuevaPoliza=true` tras conversión), citas, servicios, **Línea de Tiempo**; todo loguea actividades |
| `/ventas` | **Modelo nuevo**: crear oportunidad (persona+producto, estado 'Por diagnosticar'); dentro de cada tarjeta: cotizaciones por aseguradora (chip por estado, prima editable inline —Pendiente pasa sola a Cotizada—, agregar [Cotizar en aseguradora], eliminar); estados de oportunidad ampliados; legado visible como "Registro anterior" |
| `/agenda`, `/servicios`, `/tramites`, `/diagnosticos`, `/metricas`, `/mas` | Igual que antes + Métricas ahora incluye **Velocidad de Respuesta** (leads del mes, % contactados en 5 min, promedio en minutos, alerta de leads sin contacto) |

### Públicas
`/login`, `/solicitud`, `/cotizar/auto`, `/cotizar/vida`, `/cotizar/retiro`,
`/referidos`, `/empresas` (vía `LandingLead`; imports corregidos), `/aviso-de-privacidad`.

### Componentes
- `lumo.tsx`: `Icon` (~25 SVG propios), `BottomNav` (5 tabs), `PageHeader`.
- `LumoCapture.tsx`: botón "+" global → `/api/lumo` **con token Bearer** →
  revisión con checkboxes → ejecución bajo RLS → **log de actividades por acción
  ejecutada** (mapa acción→tipo) → `acciones_ia`. `crear_oportunidad` usa el
  modelo nuevo (oportunidad + cotización anidada). Botón WhatsApp loguea
  `contacto_whatsapp` y sella primer contacto.
- `LumoDictado.tsx`: MediaRecorder → `/api/lumo-dictado` **con token Bearer** →
  confirmación → inserta prospecto.
- `LandingLead.tsx`: landing configurable (honeypot, UTM, consentimiento).

## 5. Sistema de Diseño

"LUMO Design System" (estética cuaderno/papel) en `globals.css` con Tailwind v4:
paleta `--color-paper #F5F1E8`, `--color-card #FFFDF8`, `--color-ink #141414`
(+soft/faint), azul `#1F3FD8`, rojo `#E0342B`, verde `#1E7F4F`; fuentes
Instrument Sans + Caveat (`.font-hand`); clases `.lumo-card`, `.lumo-lines`,
`.lumo-input`, `.lumo-btn-primary/-danger/-ghost`, `.lumo-chip` (+azul/rojo/negro),
`.lumo-tape`, `.lumo-section-title`, `.lumo-underline`; textura de papel punteada.

## 6. Integraciones Externas y Automatización

### OpenAI (todo autenticado, medido en `ai_usage`, supervisado)
Whisper (dictado) · Chat Completions (intérprete y extracción, `json_object`) ·
Responses API (mensaje de primer contacto). Regla dura: la IA nunca genera primas.

### n8n (`n8n/`, Docker local)
1. **`flujo-leads-automatico.json`**: Schedule 2 min → Config (supabase_url,
   service_key, whatsapp_phone, callmebot_apikey) → GET leads `fuente=eq.landing
   & n8n_procesado=is.null` → **nodo Code único "Procesar Leads"** (usa
   `this.helpers.httpRequest`; por lead: crea **1 oportunidad 'Por diagnosticar'**
   → N `cotizaciones` 'Pendiente' con `url_cotizador` según producto (Auto:
   AXA/HDI/ABA/GNP; Vida y GM: GNP/MetLife/AXA; Hogar: AXA/HDI/GNP; Retiro:
   Profuturo/MetLife; Empresas: GNP/MetLife/AXA; Referido: GNP/AXA) → registra
   actividad `oportunidad_creada` → WhatsApp al asesor vía CallMeBot → PATCH
   `n8n_procesado`; si un lead falla NO se marca y se reintenta al ciclo siguiente).
2. **`flujo-cotizaciones.json`**: Webhook POST `/webhook/cotizar`
   `{prospecto_id, producto}` → busca prospecto → 1 oportunidad ('Cotizando') →
   6 cotizaciones (AXA/HDI/ABA/GNP/MetLife/Profuturo) → responde con links.

### Otras
CallMeBot (avisos al asesor; pendiente migrar a WhatsApp Business Platform para
mensajes A3 al cliente — ver ENFOQUE_LUMO.md), deep links `wa.me` (prefijo 52),
Google Fonts.

## 7. Variables de Entorno Requeridas (solo nombres)

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Obligatoria** (cliente y servidor; sin fallback) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Obligatoria** (ídem) |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/leads`, rate limits, `ai_usage` (solo servidor) |
| `OPENAI_API_KEY` | Rutas de IA |
| `LUMO_LEAD_OWNER_ID` | UUID dueño de leads del embudo |
| `LUMO_MODEL`, `OPENAI_MODEL` | Opcionales (default `gpt-4o-mini`) |

## 8. Resumen de Funcionalidades Clave

- **Circuito operativo completo** (diferenciador central): capturar → entender →
  confirmar → registrar → recordar → priorizar (Hoy) → **preparar (briefing)** →
  contactar → **cerrar ciclo (post-llamada 1 toque)**, todo trazado en la
  **línea de tiempo universal**.
- **Speed-to-lead medido**: sellado atómico de primer contacto, decisión ⚡ en
  Hoy con minutos transcurridos, métricas de % en 5 min.
- **LUMO Captura** (texto/dictado → acciones confirmables, privacidad por diseño,
  auditadas) y **Dictáfono Whisper** con poka-yoke.
- **Embudo Flash seguro**: 6 landings, honeypot, rate limiting atómico en BD,
  dedupe por índice único, UTM punta a punta, consentimiento versionado.
- **Modelo de ventas correcto**: 1 oportunidad → N cotizaciones anidadas (el
  pipeline cuenta intenciones reales; n8n ya no infla métricas).
- **Conversión transaccional** con candado, migración de historial, postventa
  automática a 15 días y actividad registrada.
- **Motor de siguiente mejor acción** por reglas explicables (6 fuentes de
  decisión, urgentes primero, resolución de 1 toque).
- **Seguridad**: RLS total multi-tenant, APIs con Bearer + rate limit + Zod,
  claves solo en entorno, esquema reproducible, consumo de IA medido.
- **Enfoque** (`ENFOQUE_LUMO.md`): empleado digital del asesor con autonomía por
  nivel de riesgo (A3 total → A0 solo humano); fuera para siempre: emisión,
  suscripción, siniestros, pagos, contabilidad, datos médicos, primas inventadas.
  Brechas para el flujo 100% autónomo: WhatsApp Business Platform (contratación)
  y API de multicotizador (Segutrends/MOVI) — ambas se enchufan a n8n sin
  rediseño.

### Pendientes conocidos
CallMeBot → WhatsApp Cloud API/Twilio; auth server-side de páginas (middleware/SSR);
lint legado en páginas viejas (`any`, comillas — no bloquea build); memoria
semántica, secuencias A2, renovaciones por etapas 90/60/30, inbox WhatsApp,
comisiones básicas e importación CSV = capa dos (ver ENFOQUE_LUMO.md §6).

### Verificación
`tsc --noEmit` (strict) sin errores · `next build` compila las 25 rutas ·
flujos n8n JSON válidos.
