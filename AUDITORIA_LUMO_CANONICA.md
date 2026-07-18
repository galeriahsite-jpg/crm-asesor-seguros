# Auditoría estratégica y técnica · CRM LUMO

**Proyecto:** LUMO · CRM inteligente para asesores de seguros  
**Fecha:** 18 de julio de 2026  
**Versión del reporte:** Canónica — consolidada, corregida y verificada contra el código fuente  
**Alcance:** Producto, arquitectura, seguridad, automatización, IA, experiencia de usuario, deuda técnica, escalabilidad e innovación.

> Documento canónico del proyecto. Fusiona la auditoría técnica de código (Claude, `AUDITORIA_CONTEXTO.md`) con la auditoría estratégica (ChatGPT), con dos correcciones verificadas contra el código: alcance real de RLS y contenido real del Centro de Decisiones.

---

# 1. Visión y propósito

LUMO es la **memoria operativa del asesor de seguros**: escucha cada apunte, lo convierte en una acción y evita que una oportunidad se pierda por falta de seguimiento.

No compite con los portales de aseguradoras como AXA, GNP, MetLife, Profuturo u otras. Su función no es emitir pólizas, sustituir procesos de suscripción ni administrar documentación legal oficial.

LUMO administra:

- la relación con prospectos y clientes;
- el seguimiento comercial;
- la agenda;
- las ventas;
- los pendientes;
- las próximas acciones;
- las notas;
- los servicios;
- los trámites;
- y la memoria diaria del asesor.

Su promesa tangible es:

> **LUMO recuerda por ti y convierte cada conversación en la siguiente acción correcta.**

La diferenciación estratégica no debe centrarse únicamente en “tener inteligencia artificial”, sino en reducir olvidos, tiempos muertos, capturas repetitivas y oportunidades sin seguimiento.

---

# 2. Resumen ejecutivo

LUMO ya es un CRM funcional y avanzado para un asesor individual. Ha logrado digitalizar gran parte de la libreta del asesor, construir un embudo comercial real, implementar captación pública segura y añadir una primera capa útil de inteligencia artificial.

Sin embargo, todavía no es plenamente una **libreta inteligente proactiva** ni una plataforma Enterprise.

Actualmente se encuentra entre tres niveles de madurez:

1. Libreta digital: lograda.
2. CRM operativo: logrado en gran parte.
3. Asistente reactivo con IA: logrado parcialmente.

Los siguientes niveles todavía están pendientes:

4. Asistente proactivo.
5. Memoria operativa inteligente.
6. Plataforma multiusuario escalable y auditable.

---

# 3. Evaluación general

| Dimensión | Evaluación |
|---|---:|
| Digitalización de la libreta | 9/10 |
| CRM operativo del asesor | 8/10 |
| Embudo comercial | 8/10 |
| Captación Flash | 8.5/10 |
| IA para captura | 7.5/10 |
| IA contextual de ventas | 5.5/10 |
| Automatización proactiva | 6/10 |
| Seguridad actual | 6.5/10 |
| Integridad de datos | 6/10 |
| Escalabilidad Enterprise | 4.5/10 |
| Experiencia móvil | 8/10 |
| Diferenciación de producto | 7.5/10 |

---

# 4. Stack tecnológico e infraestructura

## Frontend

- Next.js 16 con App Router.
- React 19.
- TypeScript en modo estricto.
- Tailwind CSS v4.
- Tema visual definido en CSS mediante `@theme`.
- Arquitectura móvil-first.

## Backend y base de datos

- Supabase Cloud.
- PostgreSQL.
- Supabase Auth.
- Row Level Security. **Nota verificada:** el repositorio solo contiene políticas RLS para `prospectos`, `acciones_ia` y `web_rate_limits`; las demás tablas (`clientes`, `citas`, `oportunidades`, `polizas`, `servicios`, `tramites`, `diagnosticos`, `aseguradoras`) se asumen con políticas equivalentes creadas directamente en Supabase, fuera del repo. Confirmar antes de tratarlo como garantizado (paso 10 de la hoja de ruta).
- Separación multi-tenant mediante `user_id` en todas las tablas.

## Inteligencia artificial

- OpenAI Whisper para transcripción de audio.
- GPT-4o-mini para interpretación, generación de texto y extracción estructurada.
- Responses API para generación de mensajes.
- Chat Completions para acciones estructuradas en otras rutas.

## Automatización

- n8n local ejecutado en Docker.
- Polling de Supabase cada dos minutos.
- Flujos de creación de oportunidades y notificaciones.

## Despliegue

- Vercel para frontend y Route Handlers.
- Supabase Cloud para base de datos.
- n8n local como capa de automatización auxiliar.

---

# 5. Arquitectura de base de datos

## Tablas principales

### `prospectos`

Es el hub central del CRM.

Contiene:

- identidad del prospecto;
- teléfono;
- producto;
- etapa;
- nota;
- próxima acción;
- fecha próxima;
- relación con cliente;
- atribución de campañas;
- consentimiento;
- teléfono normalizado;
- marca de procesamiento n8n.

Incluye índice único parcial por:

```text
user_id + telefono_normalizado
```

Esto permite deduplicación atómica por asesor.

### `clientes`

Almacena clientes convertidos y activos.

### `polizas`

Relación uno a muchos:

```text
cliente
→ múltiples pólizas
```

Las pólizas deben considerarse referencias comerciales y no documentos oficiales.

### `citas`

Gestiona:

- llamadas;
- videollamadas;
- visitas;
- diagnósticos;
- seguimientos;
- servicios.

### `oportunidades`

Actualmente representa cotizaciones y ventas. Requiere reestructuración para distinguir claramente:

- oportunidad comercial;
- cotizaciones por aseguradora;
- decisión final.

### `tramites`

Controla procesos en curso:

- información incompleta;
- requisito adicional;
- pago pendiente;
- seguimiento por folio.

### `servicios`

Gestiona postventa, aclaraciones, cambios y siniestros.

### `diagnosticos`

Almacena necesidades, contexto y criterios comerciales.

### `acciones_ia`

Registra:

- texto original;
- propuesta de IA;
- acciones confirmadas;
- resultado;
- fecha;
- asesor.

Es una base importante para explicabilidad y auditoría.

### `web_rate_limits`

Implementa límites atómicos de uso mediante base de datos.

---

# 6. Relaciones y ciclo comercial

La arquitectura permite el flujo:

```text
Prospecto
→ cita
→ diagnóstico
→ oportunidad
→ seguimiento
→ conversión
→ cliente
→ póliza
→ servicio
→ renovación
```

`prospectos` funciona como centro inicial y las tablas operativas se relacionan mediante:

- `prospecto_id`;
- `cliente_id`;
- `user_id`.

La conversión de prospecto a cliente migra relaciones y crea continuidad de historial. Sin embargo, actualmente no se ejecuta dentro de una transacción única.

---

# 7. Arquitectura de APIs

## `/api/leads`

Ruta pública para el Embudo Flash.

Funciones:

- recibe formularios públicos;
- valida entradas;
- limita tamaño;
- normaliza teléfono;
- captura UTM;
- exige consentimiento;
- usa honeypot;
- aplica rate limiting;
- asigna el lead;
- deduplica;
- inserta mediante `service_role`.

### Evaluación

Es una de las partes más maduras del proyecto.

## `/api/generar-mensaje`

Ruta privada.

Funciones:

- exige sesión;
- recibe `prospectoId`;
- consulta datos bajo RLS;
- genera primer mensaje de WhatsApp;
- limita uso;
- valida salida.

### Evaluación

Correcta como primera versión, pero todavía limitada al primer contacto.

## `/api/lumo`

Interpreta texto libre y propone acciones estructuradas:

- crear prospecto;
- crear cliente;
- crear cita;
- definir próxima acción;
- crear oportunidad;
- crear servicio;
- cambiar estado;
- registrar nota;
- generar mensaje.

### Riesgo

No exige autenticación. Puede ser invocada por terceros y consumir saldo de OpenAI.

## `/api/lumo-dictado`

Procesa audio:

- recibe archivo;
- transcribe con Whisper;
- extrae información estructurada;
- devuelve datos para revisión.

### Riesgo

No exige autenticación ni rate limiting propio.

Es actualmente la ruta más expuesta.

---

# 8. Frontend, landings y sistema LUMO

## CRM privado

Incluye:

- Hoy.
- Prospectos.
- Ficha 360°.
- Clientes.
- Expediente 360°.
- Agenda.
- Ventas.
- Trámites.
- Servicios.
- Diagnósticos.
- Métricas.
- Directorio de aseguradoras.

## Embudo Flash

Landings públicas:

- `/solicitud`
- `/cotizar/auto`
- `/cotizar/vida`
- `/cotizar/retiro`
- `/referidos`
- `/empresas`

Estas páginas utilizan captación de baja fricción y el componente reutilizable `LandingLead`.

## Captura Universal

`LumoCapture` permite:

```text
Texto, nota pegada o dictado
→ interpretación por IA
→ propuesta de acciones
→ revisión del asesor
→ ejecución en Supabase
→ auditoría
```

Es una de las funciones con mayor valor estratégico.

## Dictáfono Inteligente

`LumoDictado` permite:

```text
Audio
→ Whisper
→ extracción estructurada
→ tarjeta de confirmación
→ creación de prospecto
→ próxima acción
```

## Sistema visual

Identidad tipo cuaderno:

- fondo papel;
- tarjetas;
- cinta decorativa;
- tipografía manuscrita;
- estética móvil;
- navegación inferior;
- iconografía propia.

Esto refuerza el posicionamiento de libreta inteligente.

---

# 9. Automatización con n8n

## Flujo automático de leads

Cada dos minutos:

1. consulta leads nuevos;
2. identifica producto;
3. crea oportunidades “Cotizando”;
4. notifica al asesor;
5. marca el lead como procesado.

## Cotizador manual

Un webhook recibe:

```text
prospecto_id + producto
```

y crea 6 oportunidades fijas (AXA, HDI, ABA, GNP, MetLife, Profuturo). El flujo automático, en cambio, crea 2–4 oportunidades según el producto del lead (ej. Auto: AXA/HDI/ABA/GNP; Retiro: Profuturo/MetLife).

## Limitaciones

- polling constante;
- dependencia de equipo local;
- credencial privilegiada en nodos;
- baja disponibilidad;
- ausencia de cola;
- CallMeBot no es Enterprise;
- creación de múltiples oportunidades puede distorsionar métricas.

---

# 10. Qué sí logró LUMO

## 10.1 Digitalización operativa

Centralizó:

- libreta;
- recordatorios;
- prospectos;
- clientes;
- agenda;
- ventas;
- servicios;
- trámites.

## 10.2 Regla de próxima acción

El Centro de Decisiones identifica (con pregunta, razón explicada y botones [Sí, mañana] [Revisar] [Ignorar]):

- prospectos sin próxima acción;
- seguimientos vencidos;
- citas pasadas sin resultado.

**Precisión verificada en código:** los trámites detenidos NO entran al Centro de Decisiones; aparecen en el dashboard "Hoy" solo como alerta/contador ("N trámites atorados") con enlace a `/tramites`, sin acción de un toque.

## 10.3 Captación segura

El Embudo Flash evita inserción pública directa y utiliza controles robustos.

## 10.4 IA supervisada

Las acciones propuestas son revisadas por el asesor antes de ejecutarse.

## 10.5 Separación frente a aseguradoras

LUMO no intenta sustituir emisión, suscripción ni documentación oficial.

## 10.6 Conversión con continuidad

Las relaciones se migran del prospecto al cliente.

## 10.7 Identidad de producto

El sistema visual y conceptual es coherente con la idea de memoria y libreta.

---

# 11. Qué está logrado parcialmente

## Dictáfono

Existe, pero su ruta avanzada no está protegida.

## Copiloto de ventas

Genera primer contacto, pero aún no interpreta de manera completa:

- etapa;
- objeción;
- historial;
- diagnóstico;
- días sin contacto;
- próxima acción.

## Mi Día

Detecta pendientes, pero no prioriza completamente por impacto, urgencia y contexto.

## Auditoría de IA

Existe, pero puede perderse si se registra como operación secundaria.

## Servicios

Existe el módulo, pero no el Concierge completo que clasifique mensajes, cree casos y redacte respuestas.

## Agenda

Puede crear citas, pero falta detección de conflictos y flujo posterior a llamada.

---

# 12. Qué todavía no existe

## Memoria semántica

El asesor todavía no puede preguntar:

> ¿Quién era el prospecto que conocí en un desayuno y tenía dos hijos?

Se requiere `pgvector`, embeddings, RLS y recuperación con referencias.

## Briefing automático

Antes de una llamada debería aparecer:

- resumen;
- necesidad;
- última conversación;
- objeción;
- promesa;
- pregunta pendiente.

## Flujo posterior a llamadas

Después de una llamada:

```text
Dictar resultado
→ actualizar etapa
→ crear próxima acción
→ registrar compromiso
→ generar seguimiento
```

## Concierge de Servicio

Debe:

- leer el mensaje del cliente;
- clasificar;
- detectar urgencia;
- crear servicio;
- redactar respuesta;
- programar seguimiento.

## Agente de calidad de datos

Debe detectar:

- duplicados;
- fechas contradictorias;
- registros huérfanos;
- teléfonos inválidos;
- oportunidades incompletas;
- servicios cerrados con tareas abiertas.

## Motor de eventos

Falta una capa que reaccione automáticamente a cambios relevantes.

---

# 13. Riesgos y deuda técnica

## Crítico 1 · APIs de IA públicas

`/api/lumo` y `/api/lumo-dictado` deben exigir:

```text
Bearer token
→ Supabase Auth
→ rate limit
→ validación
→ ejecución
```

## Crítico 2 · Conversión no transaccional

Debe crearse un RPC:

```sql
convertir_prospecto_a_cliente(p_prospecto_id uuid)
```

Toda la migración debe ocurrir en una sola transacción.

## Alto 3 · Claves hardcodeadas

Mover a:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Alto 4 · Auth solo en cliente

Implementar:

- Supabase SSR;
- layouts protegidos;
- middleware;
- separación `(public)` y `(crm)`.

## Alto 5 · Falta esquema base reproducible

Se necesita una migración completa del esquema.

## Alto 6 · n8n local

Requiere evolucionar a:

- outbox;
- cola;
- worker;
- webhook seguro;
- automatización desplegada.

## Alto 7 · CallMeBot

Debe sustituirse por:

- Meta WhatsApp Cloud API;
- Twilio;
- 360dialog;
- notificaciones push.

## Alto 8 · Validación inconsistente

Zod está instalado, pero no se usa de manera uniforme.

## Alto 9 · Falta observabilidad

No existe una capa completa de:

- errores;
- costos;
- duración;
- tokens;
- rutas;
- fallos de automatización.

---

# 14. Reestructuración de oportunidades

El modelo actual puede crear varias oportunidades por aseguradora para un solo lead.

Esto distorsiona:

- número de oportunidades;
- pipeline;
- conversión;
- métricas.

## Modelo recomendado

```text
Oportunidad
├── Prospecto
├── Producto
├── Etapa
└── Cotizaciones
    ├── AXA
    ├── GNP
    ├── MetLife
    └── otras
```

Al entrar un lead:

```text
1 oportunidad
Estado: Por diagnosticar
```

Después del diagnóstico, el asesor agrega cotizaciones.

---

# 15. Innovaciones prioritarias

## 15.1 Velocidad de respuesta

Añadir:

```text
lead_received_at
first_contact_at
first_response_minutes
```

Métricas:

- respuesta promedio;
- porcentaje en cinco minutos;
- conversión por tiempo;
- leads sin contacto.

## 15.2 Tabla universal de actividades

Crear:

```text
actividades
├── id
├── user_id
├── prospecto_id
├── cliente_id
├── oportunidad_id
├── tipo
├── descripcion
├── metadata
└── created_at
```

Esto unifica la línea de tiempo.

## 15.3 Siguiente mejor acción

Usar reglas primero:

```text
Lead nuevo → contactar
Cita cercana → preparar
Propuesta antigua → seguimiento
Servicio detenido → revisar
Renovación próxima → contactar
```

La IA debe explicar y redactar, no decidir sola.

## 15.4 Briefing antes de llamada

Resumen automático de 20 segundos.

## 15.5 Registro después de llamada

Dictado guiado y actualización automática supervisada.

## 15.6 Centro de decisiones por lotes

Aprobar múltiples acciones desde una sola pantalla.

## 15.7 Memoria semántica

Búsqueda natural sobre:

- notas;
- diagnósticos;
- servicios;
- resultados;
- actividades.

## 15.8 PWA y modo offline

Permitir:

- guardar audios;
- capturar notas;
- crear prospectos;
- sincronizar después.

## 15.9 Multiasesor por slug

Ejemplos:

```text
/cotizar/josue
/cotizar/maria
/cotizar/carlos
```

Tabla:

```text
formularios_publicos
├── user_id
├── slug
├── activo
├── productos
├── mensaje
└── campaña
```

## 15.10 Control de costo de IA

Tabla:

```text
ai_usage
├── user_id
├── route
├── model
├── input_tokens
├── output_tokens
├── estimated_cost
├── duration_ms
├── success
└── created_at
```

---

# 16. Innovaciones adicionales

## Modo Radar

Detecta:

- prospectos olvidados;
- servicios críticos;
- renovaciones;
- citas sin resultado;
- oportunidades detenidas.

## Control de promesas

Cada frase como:

> Te llamo el viernes.

debe convertirse en compromiso y próxima acción.

## Inbox universal

Permite pegar:

- mensajes;
- notas;
- textos;
- transcripciones.

LUMO clasifica y propone el destino.

## Secuencias sugeridas

LUMO propone secuencias, pero no envía sin aprobación.

## Efectividad de mensajes

Medir:

- mensaje generado;
- mensaje editado;
- mensaje copiado;
- WhatsApp abierto;
- respuesta;
- cita;
- conversión.

## Historial reversible

Permitir deshacer cambios importantes.

## Auditoría interna de aseguradoras

Medir:

- tiempo de respuesta;
- requisitos adicionales;
- tiempo de emisión;
- casos detenidos;
- experiencia registrada.

Debe presentarse como métrica interna.

---

# 17. Arquitectura futura recomendada

```text
CAPA 1 · DATOS
Supabase, RLS, migraciones y auditoría

CAPA 2 · EVENTOS
Outbox, colas, jobs y notificaciones

CAPA 3 · REGLAS
Prioridad, próximas acciones, calidad e integridad

CAPA 4 · IA
Transcripción, extracción, resumen, búsqueda y mensajes

CAPA 5 · EJECUCIÓN
RPC transaccionales y herramientas autorizadas

CAPA 6 · EXPERIENCIA
Hoy, Captura, Agenda, Ventas, Clientes y Servicio
```

---

# 18. Hoja de ruta

## Fase inmediata · Blindaje

1. Proteger `/api/lumo`.
2. Proteger `/api/lumo-dictado`.
3. Añadir rate limiting de audio.
4. Crear RPC transaccional.
5. Mover claves a variables de entorno.
6. Crear migración base.
7. Estandarizar Zod.
8. Añadir monitoreo de IA.
9. Reducir dependencia de CallMeBot.
10. Revisar permisos de todas las tablas.

## Fase operativa · Asistente proactivo

11. Tabla universal de actividades.
12. Velocidad de respuesta.
13. Briefing antes de llamadas.
14. Registro posterior.
15. Concierge de Servicio.
16. Prioridad real en Mi Día.
17. Reestructurar oportunidades.
18. Agente de calidad de datos.
19. Centro de decisiones por lotes.
20. Historial reversible.

## Fase inteligente · Memoria

21. Memoria semántica.
22. Búsqueda natural.
23. Motor de eventos.
24. Personalización por asesor.
25. Formularios por slug.
26. Control de costo.
27. Evaluaciones de IA.
28. Métricas de efectividad.
29. Secuencias sugeridas.
30. PWA offline.

---

# 19. Modelo de madurez

## Nivel 1 · Libreta digital

**Estado:** logrado.

## Nivel 2 · CRM operativo

**Estado:** logrado en gran parte.

## Nivel 3 · Asistente reactivo

**Estado:** logrado parcialmente.

## Nivel 4 · Asistente proactivo

**Estado:** pendiente.

## Nivel 5 · Memoria operativa inteligente

**Estado:** visión futura.

## Nivel 6 · Plataforma escalable multiasesor

**Estado:** pendiente.

---

# 20. Veredicto final

## Lo que LUMO ya es

> Un CRM móvil especializado para asesores, con captación segura, seguimiento, agenda, embudo, clientes y una primera capa de inteligencia artificial.

## Lo que aún no es

> Una memoria proactiva y completamente confiable que observe toda la operación, ejecute acciones transaccionales y acompañe automáticamente cada conversación.

## Oportunidad estratégica

LUMO debe ocupar el espacio que los portales de aseguradoras no resuelven:

- quién requiere atención;
- qué se habló;
- qué prometió el asesor;
- qué debe hacerse hoy;
- qué proceso está detenido;
- qué cliente necesita seguimiento;
- y cuál es la siguiente acción correcta.

La siguiente gran versión debe concentrarse en tres capacidades:

1. Briefing automático antes de cada llamada.
2. Registro guiado después de cada interacción.
3. Motor explicable de siguiente mejor acción.

La dirección más diferenciadora sigue siendo:

> **LUMO es la memoria operativa del asesor: escucha cada apunte, lo convierte en una acción y evita que una oportunidad se pierda por falta de seguimiento.**
