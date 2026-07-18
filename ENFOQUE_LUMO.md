# LUMO · Definición de producto y enfoque

**Propósito de este documento:** ser el filtro contra el que se evalúa cada función
antes de programarla. Síntesis de: auditoría técnica del código, auditorías
estratégicas, comparativas de mercado y la visión de automatización total del dueño.
Fecha: 2026-07-18 (v2 — enfoque de autonomía máxima).

---

## 1. Qué es LUMO

**LUMO es el empleado digital del asesor de seguros: un sistema que capta, atiende,
da seguimiento y prepara ventas automáticamente, para que el asesor solo haga lo
que únicamente un humano puede hacer — cerrar, asesorar y mantener la relación.**

La libreta fue la primera metáfora; la ambición real es mayor: el asesor publica
una campaña y LUMO (CRM + n8n + IA) trabaja solo: recibe al lead, le responde,
recopila lo que falta, prepara la cotización y agenda la cita. El asesor entra
al final, no al principio.

En una frase para el asesor:

> **LUMO trabaja tu cartera 24/7; tú solo llegas a cerrar.**

Frente al mercado:

> Otros CRM guardan datos y esperan a que tú trabajes. LUMO trabaja y te entrega
> clientes listos para hablar.

---

## 2. El principio rector: autonomía por nivel de riesgo

No es "la IA propone y el humano confirma todo" (eso mata la escala), ni "todo
automático" (eso manda precios inventados a clientes). La regla es:

> **Automatización total donde el riesgo es bajo. Supervisión únicamente donde hay
> dinero comprometido, promesas legales o datos sensibles.**

### Niveles de autonomía por área

| Nivel | Qué significa | Áreas |
|---|---|---|
| **A3 · Autónomo total** (LUMO lo hace solo, el asesor solo ve el registro) | Sin aprobación previa | Recepción de leads, deduplicación, atribución UTM, creación de oportunidad + cotizaciones pendientes, **primer mensaje al cliente** (plantilla aprobada), recopilación de datos faltantes, recordatorios y confirmaciones de cita, avisos al asesor, marcado de procesado, registro de actividad |
| **A2 · Autónomo con plantillas** (LUMO ejecuta solo dentro de textos/reglas que el asesor aprobó UNA vez) | El asesor aprueba la plantilla/secuencia, no cada envío | Secuencias de seguimiento (día 0/2/7/21), reactivación de fríos, avisos de renovación, felicitaciones, encuesta postventa, respuesta inicial de servicio ("recibimos tu solicitud") |
| **A1 · Asistido** (LUMO prepara, el asesor confirma en 1 toque) | Confirmación por acción | Interpretación de dictado/texto a acciones de CRM, mensajes fuera de plantilla, cambios de etapa propuestos, briefing pre-llamada, registro post-llamada |
| **A0 · Solo humano** (LUMO registra y recuerda, jamás decide) | Nunca automático | Presentar una prima al cliente **sin fuente formal**, promesas de cobertura, negociación, decisiones de suscripción/siniestro, envío de documentos legales |

La línea dura que no se cruza en ningún nivel: **la IA nunca inventa primas,
coberturas ni condiciones.** Un número que llega al cliente viene de una fuente
formal (multicotizador con API o portal de aseguradora), nunca del modelo.

---

## 3. El flujo objetivo (el norte del producto)

Este es el flujo completo que LUMO debe cumplir de punta a punta, sin que el
asesor meta mano hasta el paso 8:

```text
1. El asesor publica la landing en Meta Ads (única acción humana inicial)
2. El cliente llena la landing (auto, vida, retiro, empresas…)
3. CRM: valida, deduplica, atribuye campaña, crea prospecto           [HOY ✓]
4. n8n: crea oportunidad + cotizaciones por aseguradora               [HOY ✓]
5. IA + WhatsApp API: responde AL CLIENTE en <2 min con plantilla
   personalizada ("Hola Ana, recibimos tu solicitud de seguro de
   auto para tu Versa 2022…") y pide los datos que falten             [BRECHA 1]
6. Cotización formal vía API de multicotizador → primas reales
   de 2–4 aseguradoras                                                [BRECHA 2]
7. WhatsApp API: envía la cotización formal + propone horarios
   de llamada; agenda la cita en el CRM                               [BRECHA 1]
8. El asesor recibe el briefing y entra a CERRAR                      [HOY parcial]
9. Todo el hilo queda registrado en la línea de tiempo del cliente    [POR CONSTRUIR]
```

### Las 2 brechas y cómo se cierran (son contrataciones, no desarrollos)

**Brecha 1 — Hablarle al cliente por WhatsApp automáticamente.**
CallMeBot solo notifica al asesor. Para mensajes salientes al cliente se requiere
**WhatsApp Business Platform** (Meta Cloud API directo, o vía Twilio/360dialog):
plantillas pre-aprobadas por Meta, ventana de 24 h para conversación libre,
costo por conversación. Se conecta a n8n con nodos HTTP estándar. Además
resuelve la trazabilidad (enviado/entregado/leído/respondido) y habilita la
bandeja de WhatsApp dentro del CRM (webhooks de mensajes entrantes).

**Brecha 2 — Cotizaciones formales sin humano.**
Las aseguradoras mexicanas no publican APIs de cotización (captchas, logins).
La vía real: **multicotizadores con API y convenios** (p. ej. Segutrends, MOVI
Digital) usando las claves de agente del asesor, conectados desde n8n. Mientras
no exista esa integración, el flujo degrada con gracia: LUMO recopila TODOS los
datos de cotización por WhatsApp, deja el expediente listo, y el asesor solo
pega la prima que obtuvo del portal — un clic, no una captura.

**Regla de degradación:** cada paso del flujo que aún no pueda ser autónomo debe
dejarle al asesor la MENOR fricción posible (un toque, un pegado, un clic),
nunca una captura completa.

---

## 4. Qué hace hoy (base ya construida y blindada)

- **Captura**: LumoCapture (texto/dictado → acciones confirmables), dictáfono
  Whisper, 6 landings públicas con honeypot, rate limiting, deduplicación
  atómica, UTM y consentimiento versionado.
- **Gestión**: prospectos con ficha 360°, clientes con expediente 360°, agenda,
  diagnósticos, trámites, servicios, métricas, directorio de aseguradoras.
- **Ventas**: 1 oportunidad → N cotizaciones anidadas por aseguradora con link
  al portal (pipeline de intenciones reales).
- **Automatización**: lead → oportunidad + cotizaciones + aviso WhatsApp al
  asesor (n8n, 2 min); webhook de cotización; postventa automática a 15 días al
  convertir; detección de abandono (Centro de Decisiones).
- **Conversión atómica** prospecto → cliente (transacción SQL).
- **Seguridad**: RLS total, APIs autenticadas con rate limit, Zod, claves en
  entorno, auditoría de IA (`acciones_ia`) y consumo (`ai_usage`).

---

## 5. Beneficios (en lenguaje del asesor)

| Beneficio | Cómo |
|---|---|
| **"Mi negocio atiende aunque yo esté en una cita"** | Respuesta automática al lead en <2 min, 24/7 |
| **"Yo solo entro a cerrar"** | LUMO capta, responde, recopila, cotiza y agenda; el asesor recibe briefing y llama |
| **"No se me escapa nadie"** | Próxima acción obligatoria + Centro de Decisiones + secuencias automáticas |
| **"Sé qué campaña me da dinero"** | UTM de punta a punta + velocidad de respuesta + conversión por fuente |
| **"Registro sin teclear"** | Voz y texto libre → la IA estructura |
| **"La IA no me quema con clientes"** | Plantillas aprobadas, primas solo de fuentes formales, todo auditado |
| **"No peleo con mis aseguradoras"** | LUMO orquesta la cotización, no la falsifica; la emisión sigue en el portal oficial |

---

## 6. Hoja de automatización (orden de construcción)

### Fase A — Infraestructura del flujo autónomo
1. **Línea de tiempo universal (`actividades`)**: cada evento (lead, mensaje
   enviado/recibido, llamada, cita, etapa, conversión) en una cronología por
   persona. Sin esto no hay trazabilidad del flujo automático.
2. **WhatsApp Business API** (Meta Cloud API o Twilio/360dialog) conectada a
   n8n: plantilla de primer contacto personalizada por producto + webhook de
   respuestas entrantes → actividades.
3. **Bot de recopilación**: si al lead le faltan datos para cotizar (año del
   auto, edad, fumador…), la IA los pide por WhatsApp y los guarda en el
   expediente. GPT con funciones estructuradas, dentro de la ventana de 24 h.

### Fase B — Cotización y agenda autónomas
4. **Integración multicotizador** (Segutrends/MOVI u otro con API y convenio):
   n8n envía los datos → recibe primas reales → las registra en `cotizaciones`
   → plantilla de WhatsApp las presenta al cliente.
5. **Agendado automático**: el bot ofrece horarios (contra la agenda del CRM),
   crea la cita y la confirma por WhatsApp.

### Fase C — El asesor aumentado
6. **Briefing pre-llamada** automático (contexto + promesas + objetivo).
7. **Registro post-llamada** de 1 toque + dictado → etapa + siguiente acción.
8. **Motor de siguiente mejor acción** por reglas (la IA explica y redacta).
9. **Secuencias A2** (día 0/2/7/21, reactivación, renovaciones 90/60/30/15/7).
10. **Métricas de velocidad** (first_contact, % en 5 min, conversión por fuente).

### Capa dos (después)
Memoria semántica (pgvector), Inbox universal, comisiones básicas, importación
CSV, PWA/offline, Meta Lead Ads directo (sin landing), decisiones por lotes,
LUMO Teams.

---

## 7. Filtro de decisión antes de programar

1. **¿Reduce el trabajo del asesor a cero o a un toque?** Si la función requiere
   captura manual completa, está mal diseñada.
2. **¿En qué nivel de autonomía vive (A3/A2/A1/A0)?** Clasificarla ANTES de
   construirla; el diseño cambia según el nivel.
3. **¿Un número o promesa que llega al cliente tiene fuente formal?** Si no,
   no sale.
4. **¿Queda registrado en la línea de tiempo con auditoría?** Autonomía sin
   trazabilidad es una bomba.
5. **¿Invade emisión, suscripción, siniestros, pagos o datos médicos?** Eso es
   de las aseguradoras y plataformas autorizadas; LUMO orquesta, no sustituye.

**Lo que sigue estando fuera para siempre:** emitir pólizas, decidir cobertura,
inventar primas, procesar pagos, contabilidad fiscal, guardar expedientes
médicos. No por timidez: porque ahí LUMO no agrega valor y sí acumula riesgo.
