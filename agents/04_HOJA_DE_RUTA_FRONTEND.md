# Hoja de ruta del frontend — UMLink

## Propósito

Construir el frontend por incrementos pequeños, demostrables y de calidad.
No incorporar una fase futura como un atajo dentro de una fase actual.

## Principios de diseño aprobados

- Estética moderna y profesional: fondos blancos, azul como color principal y grises azulados para jerarquía visual.
- La pantalla principal es un editor de diagramas tipo lienzo: barra superior, herramientas UML, lienzo y propiedades.
- La interfaz debe ser intuitiva: acciones frecuentes visibles, textos claros, estados comprensibles y ayuda contextual breve.
- Responsive desde el inicio: el lienzo conserva prioridad; los paneles laterales se reducen, desplazan o se ocultan de forma controlada en móvil.
- Accesibilidad: contraste suficiente, foco visible, botones con etiquetas y navegación posible con teclado.

## Fase 0 — Base técnica y guías

**Estado: completada.**

- Angular standalone y TypeScript estricto.
- Arquitectura `core`, `shared` y `features` con barriles por feature.
- Configuración centralizada de API y modelos iniciales.
- Guías para IA, compilación y pruebas iniciales.

**Criterio de salida:** `npm run build` y pruebas pasan.

## Fase 1 — Sistema visual y navegación

**Estado: en progreso.**

- [x] Barra global UMLink y navegación entre proyectos y editor.
- [x] Editor visual estático con paleta azul/blanco, herramientas, lienzo UML y panel de propiedades.
- [x] Layout responsive de escritorio, tableta y móvil para el editor.
- [x] Aplicar la misma identidad visual a la pantalla de proyectos.
- [ ] Definir componentes visuales reutilizables en `shared` cuando se repitan: botones, paneles, estados vacíos y diálogos.

**No incluye:** arrastrar elementos, persistencia, WebSocket ni IA.

**Criterio de salida:** pantallas consistentes, navegables y sin advertencias de build.

## Fase 2 — Gestión de proyectos conectada al backend

- [x] Servicio tipado base para `GET /api/projects` y `POST /api/projects`.
- [x] Habilitar CORS del backend para que Angular en `http://localhost:4200` pueda consumir la API.
- [x] Listar proyectos con `GET /api/projects` en una pantalla visual.
- [x] Crear proyecto con `POST /api/projects` y validación de formulario.
- [x] Estados de carga, vacío, error y éxito con mensajes claros y pruebas unitarias.
- [x] Abrir un proyecto, mostrar sus diagramas y crear uno nuevo.
- [x] Navegar al editor mediante una ruta que contiene `projectId` y `diagramId`.

**Criterio de salida:** se puede crear, listar y abrir un proyecto real sin datos simulados.

## Autenticación — base para pruebas locales

- [x] Registro e inicio de sesión con formularios accesibles y validación local.
- [x] Persistir sesión local e incluir JWT en las llamadas HTTP al backend.
- [x] Proteger rutas de proyectos y diagramas; permitir cerrar sesión.
- [x] Eliminar la elección manual del creador al crear un proyecto.

## Fase 3 — Gestión de diagramas y clases

- [x] Listar y crear diagramas del proyecto.
- [x] Cargar el detalle de un diagrama en el editor.
- [x] Crear la primera clase UML desde el editor.
- [ ] Crear, editar y eliminar clases usando las rutas del backend.
- [x] Mostrar y crear atributos, relaciones UML y cardinalidades según el contrato vigente.
- [ ] Reemplazar las tarjetas estáticas por datos reales.

**Criterio de salida:** un diagrama se puede guardar y recuperar conservando sus clases.

## Fase 4 — Editor UML interactivo

- Selección de elementos y panel de propiedades funcional.
- Agregar atributos, relaciones y operaciones cuando el backend exponga los contratos necesarios.
- [x] Arrastrar clases en el lienzo y conservar su posición al soltar.
- Zoom, ajuste al contenido y atajos de teclado básicos.
- Confirmaciones para acciones destructivas y opción de deshacer cuando sea viable.

**Criterio de salida:** una persona puede modelar un diagrama de clases sin depender de datos de ejemplo.

## Fase 5 — Colaboración en tiempo real

- Conexión segura al WebSocket `/ws` mediante un servicio en `features/collaboration/data-access`.
- Indicador de conexión y reconexión.
- Presencia de participantes, actualizaciones de cambios y resolución explícita de conflictos.
- Regla de experiencia: nunca ocultar un cambio remoto; se informa quién lo realizó y qué elemento afectó.

**Criterio de salida:** dos usuarios pueden colaborar sobre el mismo diagrama sin pérdida silenciosa de cambios.

## Fase 6 — Trabajo sin conexión y sincronización

- Persistencia local de operaciones pendientes.
- Indicador offline visible y estados de sincronización.
- Reintento seguro al recuperar conexión.
- Manejo de conflictos de sincronización definido y probado.

**Criterio de salida:** los cambios locales sobreviven una desconexión y se sincronizan de manera comprensible.

## Fase 7 — IA, voz e interoperabilidad

- Panel de asistencia por comandos concretos, nunca generación opaca de todo el modelo.
- Flujo de confirmación antes de que la IA cambie el diagrama.
- Comandos de voz con retroalimentación visible y alternativa de teclado.
- Importación y exportación XML según el formato acordado.

**Criterio de salida:** cada sugerencia de IA, voz o importación es revisable, reversible y comprensible por la persona usuaria.

## Reglas para cada incremento

1. Definir alcance pequeño y criterio de aceptación antes de escribir código.
2. Reutilizar `data-access` y modelos; no escribir URLs ni HTTP en páginas.
3. Añadir o actualizar pruebas relevantes.
4. Ejecutar `npm run build` y `npm test -- --watch=false`.
5. Actualizar esta hoja de ruta con el estado real y decisiones relevantes. Cada tarea terminada y probada debe marcarse inmediatamente con `[x]`; las tareas parciales se mantienen como `[ ]` y se describen con claridad.

## Próximo incremento acordado

Construir el primer flujo vertical completo, sin saltar a colaboración ni IA:

1. [x] Alinear CORS del backend con Angular (`http://localhost:4200`).
2. [x] Diseñar la pantalla de proyectos con la identidad azul/blanco aprobada.
3. [x] Conectarla a `GET /api/projects` y `POST /api/projects`.
4. [x] Cubrir estados de carga, vacío, error y éxito; probar frontend y backend.
5. [x] Abrir un proyecto y mostrar/crear sus diagramas reales.
6. [x] Cargar el detalle de un diagrama real y crear su primera clase UML desde el editor.
7. [x] Agregar atributos y relaciones UML con cardinalidad desde el editor.
