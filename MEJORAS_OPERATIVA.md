# LUMO · Fase Operativa — Guía de activación

Cierra las brechas del comparativo de mercado que están DENTRO del enfoque
(`ENFOQUE_LUMO.md`): línea de tiempo, briefing, post-llamada, motor de
decisiones y velocidad de respuesta. Sin comisiones, cobranza, documentos ni
emisión (eso lo hacen otros o no es del asesor). Fecha: 2026-07-18.

## Qué se construyó

1. **Línea de tiempo universal** (tabla `actividades`): todo evento queda en la
   cronología de la persona — lead recibido (con campaña), WhatsApp abierto,
   mensaje generado, resultado de contacto, citas, diagnósticos, oportunidades,
   cotizaciones, cambios de etapa, conversión, pólizas y servicios. Visible en
   la Ficha 360° del prospecto y el Expediente del cliente. Inmutable desde la
   app (solo inserta, no edita). La registran: el CRM, `/api/leads` y n8n.

2. **Briefing "Antes de contactar"** en la ficha del prospecto: interés y etapa,
   último movimiento, promesa pendiente, próxima cita, qué pidió en la web, y el
   objetivo sugerido por reglas (primer contacto → diagnóstico → cotización →
   cierre). Sin costo de IA: reglas explicables.

3. **Registro post-llamada de 1 toque**: "¿Cómo terminó el contacto?" con 5
   resultados (Respondió · interesado / Quiere cotización / No respondió /
   Pidió tiempo / No interesado). Cada botón ajusta la etapa, crea la próxima
   acción con fecha y registra la actividad — sin capturar nada.

4. **Motor de siguiente mejor acción** (Centro de Decisiones ampliado), en orden
   de urgencia y siempre con razón: ⚡ leads nuevos SIN primer contacto (con
   minutos transcurridos, objetivo <5 min), prospectos sin próxima acción,
   seguimientos vencidos, citas sin resultado, **renovaciones a 30 días**
   (agenda la llamada en un toque) y **trámites atorados** (agenda la revisión).

5. **Velocidad de respuesta medida** (`primer_contacto_at`, sellado atómico e
   idempotente al abrir WhatsApp, registrar resultado o confirmarlo en Hoy).
   Métricas: leads del mes, % contactado en 5 minutos, promedio de respuesta y
   leads aún sin contacto.

6. La conversión prospecto→cliente ahora también deja su actividad **dentro de
   la misma transacción** (v2 de la función SQL).

## Pasos para activar

1. **Migración** (después de `blindaje_migracion.sql`): SQL Editor → pega
   `supabase/operativa_migracion.sql` → Run.
2. **Deploy**: `git add . && git commit -m "Fase operativa" && git push`.
3. **n8n**: re-importa `flujo-leads-automatico.json` (ahora también registra la
   actividad de la oportunidad automática) y llena Config de nuevo.

## Cómo probar

- Llena una landing → en Hoy aparece "⚡ lead sin contactar · hace X min" →
  abre la ficha → el briefing dice "hacer el PRIMER contacto" → toca WhatsApp →
  vuelve a Métricas: el lead cuenta como contactado y se calcula tu velocidad.
- En la ficha, toca "Quiere cotización" → etapa pasa a Calificado, se agenda
  "Preparar y enviar cotización" para mañana y la línea de tiempo lo muestra.
- Registra una póliza con vencimiento a menos de 30 días → en Hoy aparece la
  decisión de renovación → "Agendar llamada" crea la cita de mañana.

## Nota

Los datos previos a esta migración no tienen actividades (la línea de tiempo
empieza a poblarse desde ahora) y los prospectos viejos tienen
`primer_contacto_at` NULL: si son leads ya atendidos, entra a su ficha y toca
cualquier resultado de contacto para sellarlos, o ignora la decisión en Hoy.
