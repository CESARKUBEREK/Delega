# MarchaSolo Inbox — especificación de evolución (auditoría 2026-11-12)

## Estado y alcance

Documento de producto y arquitectura preparado tras revisar el repositorio `CESARKUBEREK/Delega` (rama `main`, commit auditado `d22f9a0ad4d710dfd72ad9abe6de2873bf365005`) y el proyecto Supabase `DOrkesta` (`xgbmpziocflgsszzgyeb`).

**Este cambio es documentación solamente.** No modifica código, datos, esquema, políticas RLS ni Edge Functions.

## 1. Decisión de producto

Inbox debe evolucionar de una bandeja de mensajes con clasificación a un **centro de trabajo basado en asuntos**. El usuario gestiona qué necesita atención, qué conversación lo originó y qué trabajo se ha preparado o ejecutado.

Principios:
- El objeto de comunicación sigue siendo el hilo original del canal.
- Una tarea o compromiso no es un mensaje ni debe confundirse con el hilo.
- La IA recomienda y prepara; el estado real de una acción procede de la ejecución.
- Las autorizaciones se aplican a cada acción según riesgo y configuración del espacio.
- La interfaz oculta estados técnicos salvo cuando explican un bloqueo, error o aprobación necesaria.
- Reutilizar las tablas y servicios actuales; no duplicar Inbox, tareas, CRM, aprobaciones ni ejecuciones.

## 2. Auditoría del estado actual

### Interfaz existente

- Ruta principal: `src/app/w/[workspaceId]/bandeja/page.tsx`.
- Vistas actuales: `Para hoy` y `Todo`.
- `Para hoy` ya combina respuestas pendientes, seguimientos por correo, respuestas preparadas y tarjetas de aprobación.
- `Todo` ofrece búsqueda textual, filtros por canal/categoría/urgencia/respuesta, archivado, selección múltiple, recategorización y gestos táctiles.
- Detalle: `src/app/w/[workspaceId]/bandeja/[threadId]/page.tsx`; muestra resumen, conversación, respuesta, ficha de remitente, conversaciones recientes y clasificación editable.
- Componentes relacionados: `inbox-list.tsx`, `card-actions.tsx`, `inbox-actions.ts`, `reply-composer.tsx`, `sender-profile.tsx`, `thread-form.tsx`, `classify-button.tsx`.
- Diseño actual usa estilos específicos en `src/app/globals.css`; hay base visual coherente, responsive y controles accesibles.

### Backend y datos existentes

Tablas relevantes en DOrkesta:
- `inbox_threads`: hilo, canal, remitente, asunto, categoría, cliente/proyecto, urgencia, resumen, necesidad de respuesta, dirección del último mensaje, seguimiento silenciado, archivado y referencia a ejecución de preparación.
- `inbox_messages`: mensajes entrantes/salientes, identificadores externos, dirección, cuerpo, fecha y ejecución asociada.
- `inbox_rules`: reglas de categoría por remitente o dominio.
- `integrations`: conexiones y configuración de canales.
- `contacts`: contactos autorizados/conocidos.
- `flow_runs` y `run_events`: ejecuciones, aprobaciones pendientes, estado, errores, coste y eventos de actividad.
- `flows`: definiciones de automatizaciones.
- `audit_log` y `outbox_events`: auditoría/eventos transversales existentes.

Servicios/funciones existentes:
- Edge Functions activas: `inbox-sync`, `inbox-classify`, `inbox-reply`, además de `runs-cron`, `mail-cron`, `assistant` y conectores.
- Funciones compartidas: `_shared/inbox.ts`, `inbox-read.ts`, `inbox-classify.ts`, `inbox-prepare.ts`, `inbox-profile.ts`, `inbox-rules.ts`, `contacts.ts`.
- `inbox_record_message` registra mensajes y mantiene el hilo con deduplicación por identificadores externos.
- Las respuestas preparadas se modelan como ejecuciones `flow_runs` con trigger `inbox_prepare`; la aprobación reutiliza el sistema general de ejecuciones.
- La respuesta manual soporta correo IMAP, Telegram y WhatsApp, con validaciones propias del canal.
- La clasificación y la preparación automática ya utilizan el router de modelos y el crédito de prueba cuando corresponde.

### Seguridad observada

- RLS está habilitado en `inbox_threads`, `inbox_messages`, `inbox_rules`, `contacts`, `integrations`, `flow_runs`, `run_events` y `flows`.
- Los hilos, mensajes y reglas se limitan a administradores del espacio; los contactos y conexiones tienen políticas de lectura según membresía.
- Las Edge Functions principales de Inbox verifican JWT y validan rol de administrador.
- Los webhooks de canal que no verifican JWT deben continuar validando firma/token del proveedor en el propio handler.
- Los avisos globales de Supabase incluyen funciones SECURITY DEFINER y tablas de otros módulos sin políticas; deben tratarse en una auditoría de seguridad transversal, no corregirse como parte de este rediseño sin revisar cada contrato.
- Los asesores de rendimiento muestran índices FK sin cobertura y algunos índices no usados; no eliminar índices de Inbox basándose únicamente en una observación puntual.

## 3. Hallazgos y brechas

1. **La navegación solo separa Para hoy y Todo.** Aprobaciones y ejecuciones están mezcladas en las tarjetas o viven en el módulo general de ejecuciones.
2. **Para hoy no es multicanal de forma uniforme.** La consulta de seguimientos está limitada a correo; la preparación automática también está centrada en email. La respuesta manual tiene soporte adicional para WhatsApp y Telegram.
3. **Inconsistencia de etiqueta en el compositor.** `ReplyComposer` muestra el texto de Telegram para cualquier canal distinto de email, aunque el backend también soporta WhatsApp.
4. **La ficha de contacto es parcial.** El perfil integrado y las conversaciones relacionadas se muestran principalmente para email; no hay identidad consolidada transversal a canales.
5. **No existe un objeto explícito de compromiso detectado.** El seguimiento actual se infiere de la dirección/fecha del último mensaje; no registra promesas concretas con responsable, vencimiento y evidencia.
6. **La búsqueda de Todo es textual.** Usa ILIKE sobre campos del hilo, no búsqueda semántica ni sobre cuerpos completos de mensajes/documentos.
7. **La lista de Todo limita a 200 hilos sin paginación visible.**
8. **El detalle es funcional pero no una ficha de trabajo.** Clasificación, perfil, resumen, conversación y respuesta están presentes, pero las tareas/acciones relacionadas no tienen un espacio contextual propio.
9. **No hay una vista Inbox dedicada de actividad.** Los estados reales existen en `flow_runs` y `run_events`, pero el usuario debe navegar a ejecuciones.
10. **El modelo actual está orientado a administradores.** Antes de abrir Inbox a miembros, habría que definir permisos por rol y revisar exposición de mensajes y datos de contacto.

## 4. Arquitectura de experiencia objetivo

Mantener cuatro destinos de primer nivel:

1. **Prioridades** — asuntos que requieren respuesta, decisión, seguimiento o atención por vencimiento.
2. **Conversaciones** — todos los hilos de todos los canales, con filtros y búsqueda.
3. **Acciones** — propuestas y ejecuciones que esperan aprobación o intervención; reutiliza `flow_runs` y el componente de aprobación existente.
4. **Actividad** — ejecuciones recientes, completadas, fallidas y en curso; reutiliza `flow_runs` + `run_events`.

Archivo debe ser un filtro/estado dentro de Conversaciones, no una pestaña principal. Ajustes y reglas siguen en un panel secundario.

### Prioridades

- No crear una nueva tabla de prioridades.
- Derivar la lista de señales existentes: `needs_reply`, `last_direction`, `urgency`, `last_message_at`, `prepare_run_id`, `prepare_dismissed_at`, `followup_muted`, `archived`.
- Grupos iniciales: Responder, Decidir, Seguir y Vencimientos (solo cuando exista fecha real).
- No inventar fechas límite ni usar puntuaciones opacas.
- Mostrar una sola tarjeta por asunto/hilo y evitar duplicados entre grupos.
- Permitir que el usuario posponga o descarte una sugerencia sin borrar el mensaje original.

### Conversaciones y ficha de trabajo

- Mantener identificadores y mensajes originales por canal.
- Mostrar resumen, cronología, redacción y envío dentro del hilo.
- Panel contextual: contacto, otros hilos relacionados, cliente/proyecto, tareas/compromisos relacionados y documentos.
- Agrupar hilos entre canales solo con identidad verificada o confirmación del usuario; mantener siempre los hilos originales y permitir deshacer la asociación.
- Diseño desktop de lista + conversación + contexto; móvil como navegación por pantallas, no columnas comprimidas.
- Diferenciar claramente correo, WhatsApp, Telegram, llamadas y conversaciones web.

### Acciones y actividad

- Acciones usa la aprobación actual de `flow_runs.pending_action`; no crear una segunda cola.
- Mostrar acción concreta, canal/cuenta, destinatario, contenido o datos afectados, permisos y consecuencia antes de aprobar.
- Los estados visibles se derivan del estado de ejecución, no de etiquetas duplicadas.
- Actividad reutiliza `flow_runs` y `run_events`; traducir errores técnicos a mensajes accionables, conservando detalle técnico expandible.
- Acciones idempotentes, con claves de deduplicación y trazabilidad. No reenviar ni repetir una operación por reintento de interfaz.

## 5. Compromisos: nueva capacidad candidata

No implementar en la primera entrega sin definir la relación con el módulo de tareas general.

Modelo conceptual mínimo:
- tipo: enviar documento, llamar, confirmar, pagar, entregar, responder, otro;
- descripción breve;
- responsable;
- fecha/hora o ventana, nullable si no fue explícita;
- estado: detectado, confirmado, completado, cancelado, vencido;
- origen: `thread_id` + `message_id`;
- confianza y fragmento de evidencia;
- vínculo opcional a una tarea existente.

Reglas:
- La IA puede detectar y sugerir; no crear fechas ni promesas que no estén escritas.
- Los compromisos ambiguos requieren confirmación.
- Si ya existe un módulo de tareas que cubre el caso, crear/relacionar una tarea ahí en lugar de duplicar el objeto.
- Evaluar una tabla nueva solo después de auditar el modelo actual de tareas.

## 6. Correcciones de bajo riesgo antes del rediseño

1. Corregir el texto del compositor para WhatsApp y Telegram por separado.
2. Unificar etiquetas, iconos y metadatos de canal.
3. Añadir paginación/cursor a Todo sin cambiar el contrato de filtros.
4. Evitar que el contador de Prioridades duplique un mismo hilo entre respuesta y seguimiento.
5. Mostrar claramente qué canales admiten lectura, borrador, envío y preparación automática; no prometer paridad multicanal inexistente.
6. Asegurar que la acción manual de enviar y la aprobación de una acción automatizada tengan confirmación y registro coherentes.

## 7. Plan de entrega

### Fase 0 — estabilización y contratos
- Corregir etiquetas de canal.
- Documentar capacidades reales por canal.
- Revisar estados y transición de `flow_runs`.
- Definir telemetría de uso y errores.

### Fase 1 — navegación y UX
- Reorganizar la pantalla en Prioridades, Conversaciones, Acciones y Actividad.
- Reutilizar consultas y componentes actuales.
- Añadir paginación a Conversaciones.
- Adaptar diseño móvil y accesibilidad.
- Sin cambios de esquema previstos.

### Fase 2 — ficha contextual
- Mejorar el panel de contacto y relaciones.
- Permitir asociaciones verificadas entre hilos de canales distintos.
- Reutilizar `contacts` y conectores; definir migración solo si el modelo no soporta el vínculo.

### Fase 3 — compromisos y tareas
- Auditar primero el módulo de tareas actual.
- Integrar compromisos detectados con el sistema de tareas existente.
- Solo añadir persistencia nueva si no existe entidad equivalente.
- Añadir confirmación humana, vencimientos explícitos y trazabilidad.

### Fase 4 — búsqueda avanzada
- Búsqueda de mensajes y contexto, con permisos por workspace.
- Evaluar búsqueda full-text antes de vectorial; vectorizar solo si aporta valor medible.
- No exponer contenido de otros espacios ni documentos sin permiso.

## 8. Criterios de aceptación

- El usuario puede identificar en menos de 10 segundos qué necesita atención.
- Un hilo no aparece duplicado en Prioridades.
- Un estado de aprobación siempre coincide con el estado real de `flow_runs`.
- Una acción aprobada no se ejecuta dos veces por doble clic, refresco o reintento.
- Las comunicaciones mantienen el canal, identificador externo, destinatario y orden cronológico originales.
- La ficha nunca mezcla contactos por coincidencia débil de nombre.
- WhatsApp se identifica correctamente en composer, detalle y lista.
- La lista de conversaciones puede recorrer más de 200 hilos.
- La UI móvil permite leer y responder sin scroll horizontal.
- Las consultas y acciones respetan RLS y rol del espacio.
- Los errores de sincronización, clasificación, preparación y envío son visibles y recuperables.
- Las pruebas cubren IMAP, Telegram y WhatsApp por separado, incluyendo canales no conectados, límites de WhatsApp y mensajes duplicados.

## 9. Archivos y sistemas a modificar en implementación

Frontend:
- `src/app/w/[workspaceId]/bandeja/page.tsx`
- `src/app/w/[workspaceId]/bandeja/inbox-list.tsx`
- `src/app/w/[workspaceId]/bandeja/card-actions.tsx`
- `src/app/w/[workspaceId]/bandeja/[threadId]/page.tsx`
- `src/app/w/[workspaceId]/bandeja/[threadId]/reply-composer.tsx`
- `src/app/globals.css`

Backend solo si se requiere:
- `src/app/w/[workspaceId]/bandeja/inbox-actions.ts`
- `src/lib/inbox.ts`
- `supabase/functions/_shared/inbox-*.ts`
- Edge Functions `inbox-sync`, `inbox-classify`, `inbox-reply`
- migraciones y pruebas SQL únicamente tras confirmar brechas de esquema.

## 10. Fuera de alcance

- Reescribir Inbox desde cero.
- Crear un CRM paralelo.
- Crear un segundo sistema de tareas, aprobaciones o ejecuciones.
- Enviar automáticamente mensajes sin política explícita del usuario.
- Fusionar contactos/hilos por heurística débil.
- Añadir búsqueda vectorial o una tabla de compromisos antes de medir la necesidad y auditar entidades existentes.
- Cambiar canales, proveedores o credenciales de producción durante el rediseño visual.

## 11. Próximo paso técnico

Comenzar por la Fase 0 y la Fase 1 en una rama de trabajo, con pruebas de regresión sobre los flujos actuales. No aplicar migraciones en producción para el rediseño de navegación. Las nuevas migraciones solo se proponen después de validar el módulo general de tareas y la necesidad real de persistencia de compromisos.
