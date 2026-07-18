# GUÍA DE DEPLOY SEGURO · LUMO
Orden EXACTO. No saltes pasos. Nada de esto lo hice yo automáticamente.

## Paso 0 · Desbloquear git y commitear (en tu Mac)
El sandbox dejó un lock atascado. En Terminal:
```bash
cd ~/crm-asesor-seguros
rm -f .git/index.lock .git/HEAD.lock
git status            # verás los 11 archivos modificados de los bloques C–F
git add -A
git commit -m "Reparacion integral: bloques C-F (conversion, actividades, fix UUID selects, timeouts, n8n idempotente)"
```
Sigues en la rama `fix/reparacion-integral-lumo`. NO hagas merge todavía.

## Paso 1 · Diagnóstico de producción (Supabase)
SQL Editor → pega `SQL_DIAGNOSTICO_PRODUCCION.sql` → Run.
- Query 2 (duplicados): si devuelve filas, mándamelas ANTES de seguir.
- Lo demás es informativo (qué existe y qué falta).

## Paso 2 · Variables en Vercel (causa de los deploys en **Error**)
Vercel → Settings → Environment Variables → agrega (Production y Preview):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
Verifica que ya existan: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `LUMO_LEAD_OWNER_ID`. (Opcionales: `LUMO_MODEL`, `OPENAI_MODEL`.) Los valores están en tu `.env.local`.

### Paso 2b · Deployments en **Blocked** (causa NO confirmada — investígala)
Lo anterior explica los deployments en **Error** (reproducido localmente), pero
**"Blocked" es otro estado** y puede deberse a: deployment protection, checks de
la integración de Git, límites/spend de la cuenta, política de producción, o un
deployment cancelado por otro más reciente. Antes de asumir nada:
1. Vercel → Deployments → abre uno en estado Blocked.
2. Lee y ANOTA el mensaje exacto que muestra.
3. Si el mensaje no es obvio, pégamelo y lo diagnosticamos.
No des por hecho que agregar las variables resuelve también los Blocked.

## Paso 3 · Migración correctiva (Supabase)
SQL Editor → pega `supabase/reparacion_integral_20260718.sql` → Run.
- Se puede correr varias veces sin riesgo.
- Si aparece el WARNING de duplicados, la parte del índice se omitió sola: fusiona duplicados y re-córrela.
- Al final ejecuta el diagnóstico de nuevo y confirma: índice `prospectos_user_tel_norm_uniq` presente, 3 funciones, tablas `actividades`/`cotizaciones`/`ai_usage`.

## Paso 4 · Merge y deploy
La rama principal de este repositorio es **`main`** (verificado con
`git branch -a`: existe `main` y `remotes/origin/main`; no existe `master`).
```bash
git branch --show-current   # debe decir: fix/reparacion-integral-lumo
git checkout main
git pull origin main
git merge fix/reparacion-integral-lumo
git push origin main
```
Vercel construirá desde `main`; con las variables del Paso 2 el build debe pasar.

## Paso 5 · n8n
Importa de nuevo `n8n/flujo-leads-automatico.json` (borra/desactiva el viejo), rellena el nodo Config y actívalo.

## Paso 6 · Pruebas
Sigue `CHECKLIST_PRUEBAS_PRODUCCION.md` en orden. No des por bueno el deploy sin la sección crítica (A–D, K–L, S).

## Rollback
- Código: `git revert` del merge o volver a `master` previo (nada destructivo).
- SQL: sentencias de reversión del índice en `REPORTE_REPARACION_INTEGRAL.md` §6.
