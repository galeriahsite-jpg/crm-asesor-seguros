# DESPLIEGUE FINAL · LUMO — Paso a paso completo
Orden exacto para dejar TODO corriendo: VS Code → GitHub → Vercel → Supabase → n8n → pruebas.

---

## PASO 1 · VS Code / Terminal — subir el código
Abre la Terminal integrada de VS Code (`Ctrl+ñ` o Terminal → New Terminal):

```bash
cd ~/crm-asesor-seguros
git status                    # verás los archivos nuevos/modificados
git add -A
git commit -m "Poka-yoke TelefonoInput en 6 formularios + trigger clientes + validacion unificada"
git push origin main
```

Qué incluye este commit: componente `TelefonoInput` (solo dígitos, teclado
numérico, quita +52/521 pegado sin corromper, tope 10 con indicador 10/10 ✓)
aplicado en las 6 landings (vía `LandingLead` y `/solicitud`) y en los 4
formularios del CRM (prospectos alta/edición, clientes alta/edición) + los SQL
de triggers pendientes.

## PASO 2 · GitHub — verificar (30 segundos)
Entra a https://github.com/galeriahsite-jpg/crm-asesor-seguros → debe verse tu
commit arriba con la hora de hace un momento. (GitHub solo recibe; no hay que
hacer nada más.)

## PASO 3 · Vercel — esperar el deploy (automático)
Vercel construye solo con cada push a `main`. Entra a
Vercel → crm-asesor-seguros → Deployments y espera a que el de arriba diga
**● Ready** (~40 seg). No toques nada; las variables ya están configuradas.
Si dijera Error: abre el deployment, copia el mensaje del log y pégamelo.

## PASO 4 · Supabase — 2 SQL pendientes (manual, en orden)
Dashboard → SQL Editor → New query. Pega y corre UNO por uno:

1. **`supabase/trigger_normalizar_telefono_v2.sql`** — endurece el trigger de
   prospectos a la regla única (10 / 52+10 / 521+10; ya no `right(10)` a ciegas).
   Confirma el aviso "destructive" (es el drop/create del trigger, no toca datos).
2. **`supabase/trigger_normalizar_telefono_clientes.sql`** — agrega la columna
   `telefono_normalizado` a clientes + su trigger gemelo (sin índice único:
   dos clientes legítimos pueden compartir teléfono).

Verificación rápida (opcional):
```sql
select tgname from pg_trigger where tgname like 'trg_normalizar%';
-- Esperado: trg_normalizar_telefono_prospecto y trg_normalizar_telefono_cliente
```

## PASO 5 · n8n — activar la automatización
1. En tu Mac: abre **Docker Desktop** y espera "running".
2. Terminal: `cd ~/crm-asesor-seguros/n8n && docker compose up -d`
3. Abre http://localhost:5678
4. Si tienes el flujo viejo "Leads Automáticos": ábrelo → menú ⋯ → **Delete**
   (o desactívalo).
5. Menú ⋯ (arriba derecha) → **Import from File** →
   `~/crm-asesor-seguros/n8n/flujo-leads-automatico.json`
6. Abre el nodo **Config** y llena:
   - `supabase_url` → https://kbvbwuzhtsddqqacdfdb.supabase.co
   - `service_key` → Supabase → Settings → API → service_role
   - `whatsapp_phone` → tu número formato +521XXXXXXXXXX
   - `callmebot_apikey` → tu apikey de CallMeBot
7. Guarda y pon el toggle **Active**.
8. (Opcional) Importa también `flujo-cotizaciones.json` con el mismo Config.

Recuerda: n8n corre en tu Mac — necesita Docker encendido para procesar.
Tu lead de prueba "Prueba Reparacion LUMO" sigue pendiente (`n8n_procesado`
null): a los ~2 min de activar debe llegarte el WhatsApp y aparecer su
oportunidad "Por diagnosticar" con cotizaciones en Ventas.

## PASO 6 · Pruebas finales (5 minutos, en el sitio ya desplegado)
1. **Poka-yoke:** abre `/solicitud` → en el campo WhatsApp intenta escribir
   letras (no debe dejarte) → pega `+52 899 170 0262` → debe quedar
   `8991700262` con "10/10 ✓" → envía → "¡Solicitud recibida!".
2. **CRM manual:** Prospectos → + Nuevo → teléfono `12345` no te dejará pasar
   de ahí visualmente; si fuerzas envío corto, rechaza con "Ingresa un número
   válido de 10 dígitos". Con `+52...` pegado → se limpia solo.
3. **n8n:** verifica el WhatsApp del lead pendiente + su oportunidad en Ventas.
4. **Ciclo completo** (checklist `CHECKLIST_PRUEBAS_PRODUCCION.md`): lead en
   "Hoy" como ⚡ → ficha → WhatsApp → resultado post-llamada → oportunidad →
   convertir en cliente → póliza → renovación en Hoy.

## Si algo falla
- Vercel Error → mensaje del log del deployment.
- SQL error → texto exacto del error de Supabase.
- n8n sin procesar → abre el flujo → Executions → mira el nodo en rojo.
Me pegas cualquiera de esos y lo resolvemos.
