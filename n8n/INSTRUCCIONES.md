# n8n + Flujo de Cotizaciones para tu CRM

## 1. Instalar Docker Desktop (una sola vez)

Descárgalo de https://www.docker.com/products/docker-desktop/ e instálalo (Mac). Ábrelo y espera a que diga "Docker Desktop is running".

## 2. Levantar n8n

En Terminal:

```bash
cd ~/crm-asesor-seguros/n8n
docker compose up -d
```

Abre http://localhost:5678 y crea tu cuenta de administrador (es local, solo tuya).

Para apagarlo: `docker compose down` (tus flujos se conservan).

## 3. Importar el flujo

1. En n8n: menú (⋯ arriba a la derecha) → **Import from File** → selecciona `flujo-cotizaciones.json`.
2. Abre el nodo **Config** y reemplaza:
   - `supabase_url`: la URL de tu proyecto (Supabase Dashboard → Settings → API → Project URL).
   - `service_key`: la **service_role key** (misma pantalla). ⚠️ Es una llave con acceso total: no la subas a GitHub. Este archivo JSON tiene un placeholder, la llave real solo vivirá dentro de tu n8n local.
3. Guarda y **activa** el flujo (toggle "Active").

## 4. Probar

```bash
curl -X POST http://localhost:5678/webhook/cotizar \
  -H "Content-Type: application/json" \
  -d '{"prospecto_id": "UUID-DE-UN-PROSPECTO", "producto": "Seguro de Auto"}'
```

Qué hace: busca el prospecto en Supabase → crea 6 registros en `oportunidades` (AXA, HDI, ABA, GNP, MetLife, Profuturo) con estado **Cotizando** → te devuelve los links directos de cotización de cada aseguradora. Los verás de inmediato en la ficha del prospecto en tu CRM.

## 5. Flujo automático de leads (landings → CRM → WhatsApp)

Este es el flujo principal: `flujo-leads-automatico.json`. Cada 2 minutos revisa Supabase; por cada lead nuevo de cualquier landing crea las oportunidades "Cotizando" en las aseguradoras correctas según el producto y te avisa por WhatsApp con los datos del formulario y los links para cotizar.

**Landings disponibles** (todas guardan en tu CRM vía `/api/leads`, con UTM para campañas):

| URL | Producto |
|---|---|
| `/solicitud` | General (ya existía) |
| `/cotizar/auto` | Auto (marca, modelo, año, CP) |
| `/cotizar/vida` | Vida / Gastos Médicos (edad, fumador, dependientes) |
| `/cotizar/retiro` | Retiro (edad, afore, ahorro mensual) |
| `/referidos` | Referidos (quién recomienda + datos del referido) |
| `/empresas` | Empresas (empresa, puesto, empleados, beneficio) |

**Pasos:**

1. Corre `supabase/n8n_migracion.sql` en Supabase (SQL Editor) — agrega la columna `n8n_procesado`.
2. Configura CallMebot (WhatsApp gratis para avisos a ti mismo):
   - Agrega el número **+34 644 51 95 23** a tus contactos.
   - Mándale por WhatsApp: `I allow callmebot to send me messages`.
   - Te responderá con tu **apikey**.
3. Importa `flujo-leads-automatico.json` en n8n y llena el nodo **Config**: `supabase_url`, `service_key`, `whatsapp_phone` (formato `+521XXXXXXXXXX`) y `callmebot_apikey`.
4. Activa el flujo. Prueba llenando cualquier landing: en ~2 minutos te llega el WhatsApp y aparecen las oportunidades en el CRM.
5. Haz deploy del CRM a Vercel (las landings y la API extendida deben publicarse): `git add . && git commit && git push`.

Nota: tu Mac debe estar encendida y con Docker corriendo para que n8n procese. Si un día quieres que corra 24/7, lo movemos a n8n Cloud o un servidor.

## Sobre cotizar automáticamente en las páginas de las aseguradoras

AXA, HDI, miauto/ABA, GNP, MetLife y Profuturo **no tienen API pública de cotización**: sus cotizadores son formularios web con captcha y validaciones. n8n no puede llenarlos con simples llamadas HTTP, y automatizarlos con robots de navegador es frágil y puede violar sus términos de uso.

Por eso el flujo hace lo que sí es confiable: registra la cotización pendiente por aseguradora en tu CRM y te entrega los datos del cliente + link directo para cotizar tú en cada portal. Opciones para automatizar más adelante:

- **Portal de agente**: si tienes clave de agente (GNP, HDI, etc.), algunos ofrecen APIs o multicotizadores para asesores — esa es la vía correcta.
- **Registrar la prima de vuelta**: puedo agregar un segundo webhook para que, al capturar la prima, se actualice la oportunidad automáticamente.
