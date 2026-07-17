# LUMO · Embudo Flash seguro — Guía de activación

Definición: baja fricción para el prospecto, máxima validación en servidor, atribución
completa, deduplicación atómica y contacto con IA únicamente autorizado por el asesor.

## Las 12 correcciones de la revisión, aplicadas

| # | Corrección | Dónde quedó |
|---|-----------|-------------|
| 1 | SQL con saltos de línea correctos | `supabase/embudo_migracion.sql` |
| 2 | Índice único parcial (no solo índice de búsqueda) | Migración, sección 5 |
| 3 | Deduplicación atómica sin condición de carrera | `/api/leads`: upsert `onConflict: 'user_id,telefono_normalizado'` con DO NOTHING + actualización solo de campos seguros si ya existía |
| 4 | Rate limiting real además del honeypot | Tabla `web_rate_limits` + función atómica `incrementar_rate_limit` (5/hora por IP, 100/hora global) |
| 5 | API de IA no pública | `/api/generar-mensaje` exige token Bearer de sesión Supabase y valida al usuario |
| 6 | El navegador no envía nombre/interés | El cliente manda solo `{ prospectoId }`; la API lee los datos reales vía RLS con el token del asesor |
| 7 | Validación completa | Cuerpo JSON acotado (5 KB), nombre 2–80, teléfono MX normalizado, interés en catálogo, UUID, salida del modelo validada y acotada (700 caracteres) |
| 8 | Responses API | `/api/generar-mensaje` usa `POST /v1/responses` |
| 9 | UTM capturados de punta a punta | Landing lee `utm_source/medium/campaign` de la URL y los envía; la API los guarda |
| 10 | Errores de Supabase comprobados | Todos los `insert/update/rpc` revisan `error` antes de responder `ok` |
| 11 | `LUMO_LEAD_OWNER_ID` validado | Regex UUID + verificación de usuario activo con `auth.admin.getUserById` |
| 12 | Aviso de privacidad real y versionado | Página `/aviso-de-privacidad`, enlace en el consentimiento, `consentimiento_version: "2026-07"` guardada por lead |

Además: rate limit de 30 mensajes IA/hora por asesor, copy corregido
("Solicita información en menos de un minuto", "Un asesor revisará tu solicitud y se
comunicará contigo por WhatsApp") y prompt de IA con las reglas de la revisión.

## Pasos para activar

### 1. Migración
Supabase Dashboard → SQL Editor → pega `supabase/embudo_migracion.sql` → Run.

**Importante:** si ya existen prospectos con el mismo teléfono duplicado, el índice único
fallará al crearse. En ese caso primero limpia duplicados (el editor SQL te dirá cuáles).
Nota: los prospectos existentes tienen `telefono_normalizado` en null (el índice los ignora);
solo los leads nuevos del embudo se deduplican.

### 2. Variables de entorno en Vercel
| Variable | Valor |
|----------|-------|
| `OPENAI_API_KEY` | (ya existe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API keys → service_role. **Secreta: jamás en el frontend.** |
| `LUMO_LEAD_OWNER_ID` | Tu UUID de usuario: Supabase → Authentication → Users → copia el ID de tu cuenta |

### 3. Personalizar
- `/aviso-de-privacidad`: sustituye los campos entre corchetes con tus datos reales.
- Landing publicada en `/solicitud`. Para campañas usa:
  `tudominio.com/solicitud?utm_source=facebook&utm_medium=cpc&utm_campaign=vida-julio`

### 4. Flujo completo
1. El prospecto llena `/solicitud` → `/api/leads` valida, limita, deduplica y crea el
   prospecto a tu nombre con fuente `landing` y sus UTM.
2. Te aparece en Prospectos como "Nuevo" (y en el centro de decisiones si no le das seguimiento).
3. En su ficha, botón azul **Mensaje LUMO** → borrador editable → Copiar o Enviar por WhatsApp.

## Mejoras Enterprise pendientes (requieren servicios externos)
- Cloudflare Turnstile o Vercel Firewall para tráfico distribuido/captcha invisible.
- Observabilidad (Sentry/Logflare) sobre los `console.error` ya sembrados en las rutas.
