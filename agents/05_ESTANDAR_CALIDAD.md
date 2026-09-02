# Estándar de calidad senior — Frontend UMLink

## Objetivo

La calidad es parte del producto. El frontend debe ser legible, mantenible,
accesible, seguro y predecible; no basta con que la pantalla se vea bien.

## Antes de programar

- Leer las guías de `agents/` y revisar el contrato backend vigente.
- Definir alcance, criterio de aceptación, estado vacío/error/carga y prueba mínima.
- Si una decisión funcional no está documentada, preguntar antes de implementarla.
- Preferir el cambio más pequeño que complete el criterio de aceptación.

## Código y arquitectura

- Un componente tiene una responsabilidad clara y un nombre de dominio explícito.
- Mantener TypeScript estricto: prohibido `any`, conversiones inseguras y valores implícitos.
- Las páginas coordinan la vista; las llamadas HTTP/WebSocket viven en `data-access`.
- Los modelos definen contratos; no duplicar interfaces equivalentes en componentes.
- Usar `signals` para estado local de UI y `Observable` para límites asíncronos; no crear suscripciones que queden activas.
- Extraer componentes a `shared` solo cuando una pieza sea realmente reutilizable; no crear abstracciones prematuras.
- Eliminar código muerto, imports sin uso, comentarios que repiten el código y duplicación evidente.
- Mantener plantillas y estilos legibles. Aplicar el formateador del proyecto antes de terminar.

## Experiencia, accesibilidad y responsive

- Cada pantalla remota debe contemplar carga, vacío, error y éxito cuando aplique.
- Usar HTML semántico, etiquetas asociadas a inputs, botones con nombre accesible y foco visible.
- No comunicar información únicamente por color; mensajes y estados deben ser textuales.
- Diseñar primero el flujo principal y simplificar sin perder acciones esenciales en móvil.
- Mantener contraste alto, blancos y azules de UMLink; evitar decoraciones que compitan con el lienzo o el contenido.

## Integración y seguridad

- No escribir URLs fuera de `core/config` ni construir endpoints en las páginas.
- Enviar únicamente DTOs definidos y validar formularios antes de llamar a la API.
- No incluir secretos, tokens, datos de prueba sensibles ni `console.log` de información privada.
- Los errores técnicos no se muestran tal cual al usuario; se presentan mensajes claros y seguros.

## Pruebas y puerta de calidad

Cada cambio de comportamiento debe incluir pruebas proporcionales. Como mínimo:

- caso exitoso;
- estado de carga, vacío o error cuando la vista consume datos;
- validación de formulario si recibe datos;
- regresión del componente, servicio o ruta afectada.

Antes de marcar una tarea como hecha, ejecutar:

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

## Revisión final obligatoria

- [ ] El alcance y los criterios de aceptación se cumplieron.
- [ ] La arquitectura, contratos y restricciones de los `.md` se respetaron.
- [ ] No se agregaron dependencias, archivos o abstracciones innecesarias.
- [ ] La interfaz es accesible y responsive en el flujo afectado.
- [ ] Las pruebas y la compilación pasan.
- [ ] La hoja de ruta se actualizó con `[x]` solo para trabajo terminado y probado.
- [ ] El cierre explica qué cambió, cómo se validó y qué sigue pendiente.
