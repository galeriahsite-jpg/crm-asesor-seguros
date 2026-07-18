# CHECKLIST DE PRUEBAS EN PRODUCCIÓN · LUMO
Marca cada una. Si alguna falla, detente y repórtala (no continúes).

## Críticas (bloquean el visto bueno)
- [ ] **A. Prospecto manual:** Prospectos → + Nuevo → guardar → aparece en "Nuevos" y su ficha muestra actividad "Prospecto creado".
- [ ] **B. Lead desde landing:** llena `/solicitud` → responde "¡Solicitud recibida!" (ya sin error) → aparece en Prospectos con actividad "Lead recibido".
- [ ] **C. Mismo teléfono dos veces:** repite B con el mismo número → sigue respondiendo OK y NO se crea un segundo prospecto.
- [ ] **D. Deduplicación:** en Supabase, `select count(*) from prospectos where telefono_normalizado='<10digitos>'` → 1.
- [ ] **K. Conversión:** ficha → "Convertir en Cliente" → botón muestra "Convirtiendo…", éxito, redirige al expediente con `?nuevaPoliza=true`.
- [ ] **L. Doble conversión:** vuelve a la ficha del convertido → intento de convertir → mensaje "ya fue convertido", sin crear otro cliente.
- [ ] **M. Migración de historial:** el expediente del nuevo cliente muestra las citas/oportunidades/diagnósticos/trámites/servicios que tenía el prospecto.
- [ ] **N. Actividad convertido:** la línea de tiempo del cliente muestra "Convertido en cliente" UNA sola vez.
- [ ] **S. APIs sin token:** desde incógnita, `curl -X POST tudominio/api/lumo -d '{}'` → 401 (igual `lumo-dictado` y `generar-mensaje`).
- [ ] **V. Build:** el deployment de Vercel quedó "Ready".

## Funcionales
- [ ] **E.** Actividad `lead_recibido` visible en la ficha del lead de la prueba B (con fuente/UTM si la landing llevaba `?utm_source=...`).
- [ ] **F–G. WhatsApp + primer contacto:** botón WhatsApp desde Prospectos → en Métricas el lead cuenta como contactado; repetir el clic NO cambia la marca (sellado único).
- [ ] **H. Post-llamada:** ficha → "Quiere cotización" → etapa Calificado + próxima acción mañana + actividad registrada.
- [ ] **I–J. Ventas:** Nueva oportunidad (persona REAL vinculada — verifica que al abrir la ficha del prospecto la oportunidad aparece en "Cotizaciones Relacionadas": esto valida el fix del UUID) → agrega 2-3 cotizaciones → captura una prima (pasa a "Cotizada").
- [ ] **O. Póliza:** expediente → + Póliza con vencimiento a <30 días.
- [ ] **P. Renovación:** en "Hoy" aparece la decisión de renovación → "Agendar llamada" crea cita mañana.
- [ ] **Q. Servicio:** expediente → + Servicio → aparece en el módulo y en la línea de tiempo.
- [ ] **R. Aislamiento entre usuarios:** crea un segundo usuario en Supabase Auth → loguéate con él → NO ve prospectos/clientes/actividades del primero.
- [ ] **T. Rate limits:** repite el envío de la landing 6 veces desde la misma red → la 6ª responde "Recibimos varias solicitudes…".
- [ ] **U. Audio inválido:** en `/prospectos`, dictado con archivo grande/raro → mensaje de error claro, sin 500.
- [ ] **n8n:** con el flujo activo, lead nuevo → 1 oportunidad "Por diagnosticar" + cotizaciones + WhatsApp; apaga WhatsApp (apikey mala), fuerza un lead, reactívala → al reintentar NO se duplica la oportunidad.
