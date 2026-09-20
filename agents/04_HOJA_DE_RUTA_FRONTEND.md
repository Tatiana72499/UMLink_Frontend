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

**Estado: completada.**

- [x] Barra global UMLink y navegación entre proyectos y editor.
- [x] Editor visual estático con paleta azul/blanco, herramientas, lienzo UML y panel de propiedades.
- [x] Layout responsive de escritorio, tableta y móvil para el editor.
- [x] Aplicar la misma identidad visual a la pantalla de proyectos.
- [x] Definir componentes visuales reutilizables en `shared` cuando se repitan: botones, paneles, estados vacíos y diálogos.
- [x] Incorporar una landing pública, responsive y orientada a conversión en `/`, con accesos claros a registro e inicio de sesión.

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
- [x] Crear, editar y eliminar clases usando las rutas del backend.
- [x] Mostrar y crear atributos, relaciones UML y cardinalidades según el contrato vigente.
- [x] Reemplazar las tarjetas estáticas por datos reales.

**Criterio de salida:** un diagrama se puede guardar y recuperar conservando sus clases.

## Fase 4 — Editor UML interactivo

- [x] Selección de elementos y panel de propiedades funcional.
- [x] Colocar clases en el lienzo, agregar atributos UML en línea y crear cada tipo de relación mediante arrastre.
- [x] Mostrar cardinalidades en ambos extremos de la conexión y permitir su edición manual validada.
- [x] Completar CRUD visual de clases, atributos y relaciones UML con confirmación para eliminar.
- [x] Mejorar semántica visual de relaciones, restringir cardinalidades/tipos y permitir estilos de clase.
- [x] Incorporar lápiz colaborativo persistido: crear, borrar selectivamente y limpiar trazos compartidos.
- [x] Agregar operaciones UML en línea con retorno, visibilidad y parámetros tipados cuando el backend expone el contrato necesario.
- [x] Arrastrar clases en el lienzo y conservar su posición al soltar.clase de asociación
- [x] Incorporar zoom visual del lienzo con controles de acercar y alejar; el ajuste al contenido y los atajos de teclado siguen pendientes.
- [x] Permitir un punto de quiebre arrastrable y persistente para enrutar visualmente las relaciones.
- [x] Vincular una clase existente como clase de asociación e identificarla con el conector discontinuo UML.
- [x] Seleccionar y alinear conectores manualmente sin forzar trazado en L; abrir etiquetas con doble clic central y eliminar la relación seleccionada desde el lienzo.
- [x] Exponer Clase intermedia como herramienta UML y crear atómicamente la asociación junto con su clase vinculada.
- [x] Permitir varios puntos de alineación persistentes por relación y fijar la clase intermedia como asociación muchos-a-muchos (`1..*` en ambos extremos).
- [x] Permitir relaciones recursivas visuales y consultar el historial persistido de cambios del diagrama.
- [x] Mejorar los controles del editor: resumen plegable desde el lienzo, acciones de eliminación con icono de papelera y miniaturas UML vectoriales para las herramientas de relación.
- [x] Marcar un único atributo como llave primaria por clase desde el editor, visualizarlo como `PK` y sustituir visualmente la marca anterior al editar.
- Confirmaciones para acciones destructivas y opción de deshacer cuando sea viable.

**Criterio de salida:** una persona puede modelar un diagrama de clases sin depender de datos de ejemplo.

## Fase 5 — Colaboración en tiempo real

- [x] Conexión segura al WebSocket `/ws` mediante un servicio en `features/collaboration/data-access`.
- [x] Indicador de conexión y reconexión.
- [x] Presencia de participantes, actualizaciones de cambios y resolución explícita de conflictos.
- [x] Compartir por correo o enlace de navegación, administrar miembros y aplicar roles `OWNER`, `EDITOR` y `VIEWER`.
- [x] Previsualizar trazos remotos, señalar clases tomadas por otra persona y presentar actividad remota contextual dentro del lienzo.
- Regla de experiencia: nunca ocultar un cambio remoto; se informa quién lo realizó y qué elemento afectó.

**Estado: completada.** El transporte seguro, la presencia, la actualización remota y las membresías con roles están implementados.

**Criterio de salida:** dos usuarios pueden colaborar sobre el mismo diagrama sin pérdida silenciosa de cambios.

## Fase 6 — Trabajo sin conexión y sincronización

- Persistencia local de operaciones pendientes.
- Indicador offline visible y estados de sincronización.
- Reintento seguro al recuperar conexión.
- Manejo de conflictos de sincronización definido y probado.

**Criterio de salida:** los cambios locales sobreviven una desconexión y se sincronizan de manera comprensible.

## Fase 7 — IA, voz e interoperabilidad

- [x] Panel de asistencia por comandos textuales concretos, con validación del servidor y confirmación antes de eliminar; nunca generación opaca de todo el modelo.
- [x] Flujo de confirmación antes de que el asistente cambie el diagrama.
- [x] Comandos de voz con retroalimentación visible y alternativa de teclado, mediante la API de reconocimiento de voz disponible en el navegador.
- [x] Ampliar la comprensión de lenguaje natural mediante OpenRouter, enviando únicamente la instrucción y los nombres de clases tras aprobación explícita; el backend siempre revalida la propuesta antes de modificar el modelo.
- [x] Reubicar la interacción del asistente en una barra de chat inferior, minimizable y accesible desde un lanzador compacto.
- [x] Importar archivos XML UMLink, XMI/UML y PlantUML (`.puml`) en un diagrama nuevo, validando extensión y tamaño antes de enviarlos.
- [x] Descargar XML UMLink completo, XMI/UML genérico, XMI visual, script de Automation API compatible con Enterprise Architect 15 o código PlantUML, con el subconjunto documentado de clases, atributos, operaciones, relaciones y cardinalidades.
- [x] Descargar un backend Spring Boot generado con capas CRUD y migración PostgreSQL desde el diagrama.
- [x] Integrar vista previa de OpenRouter para transformar una imagen en PlantUML, revisar el resultado y confirmar antes de crear un diagrama nuevo.

**Criterio de salida:** cada sugerencia de IA, voz o importación es revisable, reversible y comprensible por la persona usuaria.

## Fase 8 — Aplicación Flutter generada

- [ ] Definir el contrato v1 de generación UML → Flutter junto al backend.
- [ ] Descargar un ZIP Flutter CRUD desde un diagrama válido.
- [ ] Generar modelos, cliente HTTP, listados y formularios tipados por clase UML.
- [ ] Ampliar el contrato generado con IDs relacionados y representar relaciones persistentes mediante selectores y navegación; documentar relaciones avanzadas que requieren ajuste manual.
- [ ] Incluir configuración opcional para Ollama dentro de la app generada, sin integrar Ollama en UMLink ni incluir claves.
- [ ] Validar que el ZIP generado compile, consuma el backend generado y muestre una entidad CRUD real.

**Criterio de salida:** un diagrama compatible produce backend, PostgreSQL y Flutter ejecutables con instrucciones de configuración claras.

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
