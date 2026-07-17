# LUMO · Fase 1 — Guía de activación

Qué se construyó (del documento de visión):

- **Punto 1 y 2 — Un solo LUMO que entiende intención libre.** Botón flotante azul "+" visible en toda la app (excepto login). El asesor escribe, pega o dicta texto natural y LUMO lo convierte en acciones estructuradas: crear prospecto/cliente, agendar cita, próxima acción, cotización, servicio, cambiar etapa, nota, o mensaje sugerido.
- **Punto 9 — Bandeja universal de captura.** El mismo botón acepta dictado por voz (usa el reconocimiento del navegador, funciona en Chrome y Safari; no consume API).
- **Puntos 4 y 10 — Próxima acción obligatoria + centro de decisiones.** La pantalla Hoy muestra "LUMO necesita tu decisión": prospectos sin próxima acción, seguimientos vencidos y citas pasadas sin resultado, cada una con su razón (punto 13 — explicabilidad) y botones [Sí, mañana] [Revisar] [Ignorar].
- **Punto 15 — Historial de acciones de IA.** Cada captura guarda en `acciones_ia` lo que LUMO propuso, lo que confirmaste y el resultado.
- **Punto 18 — Privacidad por diseño.** Al modelo solo se envían nombres e IDs del directorio; nunca teléfonos, pólizas ni documentos. La API key vive solo en el servidor.

## Pasos para activar

### 1. Correr la migración en Supabase
Dashboard → SQL Editor → New query → pega el contenido de `supabase/lumo_migracion.sql` → Run.

### 2. Verificar la variable de entorno en Vercel
Settings → Environment Variables → debe existir `OPENAI_API_KEY` (ya la tienes).
Opcional: `LUMO_MODEL` para cambiar el modelo (default: `gpt-4o-mini`).

### 3. Para probar en local
Crea `.env.local` en la raíz con:
```
OPENAI_API_KEY=tu_key
```
(`.env.local` ya está ignorado por git en proyectos Next).

### 4. Deploy
`git push` normal; Vercel construye y la ruta `/api/lumo` queda activa.

## Cómo probarlo
Abre la app, toca el botón azul "+" y pega:

> Conocí a Laura en el evento de ayer. Tiene una empresa con 30 empleados y le interesa revisar prestaciones. Quedé de escribirle el lunes.

LUMO debe proponer: crear prospecto, guardar nota con el contexto y seguimiento para el lunes. Revisas, desmarcas lo que no quieras y confirmas.

## Qué sigue (Fase 2, cuando quieras)
Memoria semántica con pgvector, briefing antes de llamar, detección de duplicados/contradicciones y automatizaciones por triggers de Supabase.
