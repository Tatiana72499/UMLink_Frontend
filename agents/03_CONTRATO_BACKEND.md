# Contrato con backend

Base URL local: `http://localhost:8080/api`.

Rutas actuales:

```text
POST     /auth/register
POST     /auth/login
GET/POST /projects
GET      /projects/{id}
GET      /projects/{id}/share-link
PUT      /projects/{id}
DELETE   /projects/{id}?version={version}
GET      /projects/{id}/members
POST     /projects/{id}/members
PUT      /projects/{id}/members/{memberId}
DELETE   /projects/{id}/members/{memberId}
GET/POST /projects/{projectId}/diagrams
GET      /diagrams/{diagramId}
GET      /diagrams/{diagramId}/export?format=XML|XMI|EA_XMI|EA_SCRIPT|PLANT_UML
GET      /diagrams/{diagramId}/generate/backend (ZIP de Spring Boot + Flyway)
GET      /diagrams/{diagramId}/generate/flutter (ZIP de Flutter CRUD)
POST     /projects/{projectId}/diagrams/import (multipart: file)
POST     /projects/{projectId}/diagrams/ai/image-preview (multipart: file PNG|JPG|WEBP, no persiste)
GET      /diagrams/{diagramId}/activity
POST     /diagrams/{diagramId}/assistant/commands
PUT      /diagrams/{diagramId}
DELETE   /diagrams/{diagramId}?version={version}
POST     /diagrams/{diagramId}/drawings
DELETE   /diagrams/{diagramId}/drawings/{drawingId}
DELETE   /diagrams/{diagramId}/drawings
POST     /diagrams/{diagramId}/classes
PUT      /classes/{id}
DELETE   /classes/{id}
POST     /classes/{classId}/attributes
PUT      /attributes/{id}
DELETE   /attributes/{id}
POST     /classes/{classId}/operations
PUT      /operations/{id}
DELETE   /operations/{id}
POST     /diagrams/{diagramId}/relations
POST     /diagrams/{diagramId}/association-classes
PUT      /relations/{id}
PUT      /relations/{id}/cardinality
DELETE   /relations/{id}

GET      /shared/projects/{shareToken}
GET      /shared/projects/{shareToken}/diagrams
GET      /shared/projects/{shareToken}/diagrams/{diagramId}
```

## Autenticación

- Registro: `name`, `email`, `password` (entre 6 y 8 caracteres) → `{ token, userId, name, email }`.
- Inicio de sesión: `email`, `password` (entre 6 y 8 caracteres) → `{ token, userId, name, email }`.
- El interceptor agrega `Authorization: Bearer <token>` a las llamadas de API.
- Las rutas de proyectos y diagramas requieren sesión. El propietario se asigna en el backend desde el JWT; `CreateProjectRequest` solo contiene `name` y `description`.
- La excepción son los `GET /shared/projects/{shareToken}`: se consumen sin JWT y solo habilitan una vista independiente de lectura. No se conecta al WebSocket ni muestra controles de mutación.
- Las respuestas de proyecto y diagrama incluyen `version`. Para actualizar, el frontend envía la versión recibida; para eliminar, la envía como parámetro `version`. Si recibe `409 VERSION_CONFLICT`, debe recargar el recurso antes de permitir otro intento.
- Las relaciones de asociación, agregación y composición incluyen cardinalidad de origen y destino. Las únicas opciones son `1..1`, `0..1`, `1..*` y `0..*`. Generalización representa herencia; realización y dependencia no usan cardinalidad.
- Una relación puede conectar una clase consigo misma para modelar una relación recursiva. La clase intermedia se mantiene exclusivamente para asociaciones entre dos clases diferentes; el backend fija sus dos cardinalidades en `1..*` porque representa una relación muchos-a-muchos.
- `PUT /relations/{id}/cardinality` recibe `{ sourceCardinality, targetCardinality }`; solo aplica a asociación, agregación y composición y conserva las clases y el tipo de la relación.
- Las solicitudes de atributos incluyen `primaryKey` booleano; solo un atributo de cada clase puede estar marcado como llave primaria. Al marcar otro, el backend desmarca el anterior y el editor refleja el reemplazo. `PUT /attributes/{id}` actualiza nombre, tipo, visibilidad y llave primaria. `PUT /relations/{id}` actualiza sus extremos, tipo y cardinalidades validadas.
- Los tipos de atributo permitidos son String, Integer, Long, Double, Boolean, UUID, LocalDate y LocalDateTime. Las clases exponen `fillColor` (nulo significa sin relleno) y las relaciones `label` para asociación, agregación, composición y dependencia.
- Cada clase incluye sus operaciones UML. Una operación recibe `name`, `visibility` (`PUBLIC`, `PRIVATE` o `PROTECTED`), `returnType` (`VOID` o un tipo de atributo) y hasta diez parámetros ordenados `{ name, dataType }`; sus nombres no se repiten dentro de la operación.
- Las relaciones exponen `alignmentPoints`, una lista ordenada de hasta 20 puntos `{x, y}` para alinear manualmente el conector. Se mantienen `bendX` y `bendY` solo por compatibilidad. Una asociación puede incluir `associationClassId` para vincular una tercera clase del mismo diagrama; no puede ser una de las dos clases que conecta.
- `POST /diagrams/{diagramId}/association-classes` recibe dos clases, nombre, posición y color; crea en una sola transacción la asociación muchos-a-muchos junto con su clase intermedia, fija ambos extremos en `1..*` y devuelve ambos elementos.
- Los detalles de diagrama incluyen `drawings`, una lista de rutas SVG `{ id, svgPath }`. `POST /diagrams/{diagramId}/drawings` crea un trazo; sus eliminaciones son individual o total. Solo `OWNER` y `EDITOR` pueden dibujar, borrar o limpiar.
- La exportación entrega `XML` UMLink, `XMI` UML genérico, `EA_XMI`, `EA_SCRIPT` para Enterprise Architect 15 o `PLANT_UML`. La importación recibe archivos `.xml`, `.xmi` o `.puml` de hasta 1 MB y crea un diagrama nuevo sin sobrescribir el lienzo abierto. Además del XMI/UML moderno, acepta el XMI 1.x clásico de Enterprise Architect con su subconjunto de clases, atributos, operaciones, asociaciones, generalizaciones y cardinalidades compatibles. PlantUML cubre clases, atributos, una PK por clase, operaciones, colores, relaciones, cardinalidades y clases de asociación; al importarlo, posiciones, puntos de alineación y trazos se generan nuevamente. XML UMLink conserva esos detalles visuales; `EA_XMI` crea un diagrama de clases visual; `EA_SCRIPT` crea elementos, conectores y posiciones mediante la Automation API dentro del paquete seleccionado en EA.

El frontend debe usar los DTOs en `features/projects/models` y `features/diagram/models`. Si el backend cambia un contrato, actualizar ambos lados en la misma tarea y documentar el cambio.

El análisis de imagen admite PNG, JPG o WEBP de hasta 2 MB. La respuesta es `{ plantUml, suggestedName, classCount, relationCount }` y nunca persiste cambios. El frontend debe mostrarla como propuesta revisable y, solo tras confirmación de la persona usuaria, usar la importación PlantUML para crear un diagrama nuevo.

La generación de backend devuelve un ZIP no persistido. El editor lo descarga desde el diálogo “Descargar”; incluye Spring Boot, capas CRUD por clase y `V1__initial_schema.sql` para PostgreSQL. Si el diagrama no tiene clases válidas, se muestra el error seguro retornado por el backend.

La generación Flutter devuelve un ZIP no persistido con una app CRUD basada en los atributos propios de las clases válidas del modelo. La app generada usa `API_BASE_URL` configurable para consumir el backend generado. Los selectores de relaciones se incorporarán después de que el backend generado exponga IDs relacionados. La configuración de Ollama es opcional y pertenece al proyecto Flutter descargado; Angular/UMLink no deben enviar diagramas a Ollama ni administrar sus claves o modelos.

El asistente textual recibe `{ command, confirmed }` y devuelve `{ action, summary, requiresConfirmation }`. El backend interpreta localmente frases acotadas para consultar, crear, editar y eliminar clases, atributos, operaciones y relaciones; también permite mover una clase indicando coordenadas. Toda mutación requiere vista previa y confirmación. Si un nombre o una relación es ambiguo, se rechaza la orden. El asistente de texto no usa Ollama ni OpenRouter; la IA externa de UMLink se utiliza por separado para analizar imágenes. Solo `OWNER` y `EDITOR` pueden abrir el asistente y ejecutar mutaciones.

El dictado de comandos se resuelve localmente en el navegador con `SpeechRecognition` o `webkitSpeechRecognition`, cuando el navegador lo ofrece. No agrega una ruta al backend: la transcripción se muestra a la persona usuaria para revisión y luego sigue exactamente el mismo contrato textual. Cuando la API no está disponible o no se concede permiso de micrófono, el campo de texto continúa siendo la alternativa obligatoria.

`POST /projects/{id}/members` recibe `{ email, role }`, donde `role` es `EDITOR` o `VIEWER`, y requiere una cuenta ya registrada distinta de la propietaria del proyecto. La respuesta contiene `id`, `userId`, `name`, `email` y `role`. Solo `OWNER` administra miembros; `EDITOR` modifica diagramas y `VIEWER` solo los consulta. El enlace del proyecto sirve para navegar, nunca para conceder acceso.
`GET /projects/{id}/share-link` es exclusivo del `OWNER` y devuelve un token UUID opaco. La ruta pública `/shared/projects/{shareToken}` permite que una persona sin perfil consulte el proyecto y sus diagramas, sin crear membresía. El enlace no otorga permisos de edición: para modificar, debe iniciar sesión o registrarse y recibir el rol `EDITOR` del `OWNER`. Como es una credencial de portador, nunca se debe derivar del ID de proyecto ni exponerlo fuera del enlace compartido.

## Colaboración WebSocket

- Endpoint STOMP: `ws://localhost:8080/ws`; su URL vive en `core/config`.
- El `CONNECT` incluye `Authorization: Bearer <token>`; el token nunca se coloca en la URL.
- Al abrir un diagrama, el frontend se suscribe a `/topic/diagrams/{diagramId}` y publica `PRESENCE_JOINED` en `/app/diagram-events`.
- Los eventos remotos `DIAGRAM_CHANGED` contienen la persona y una acción controlada por el servidor. Si provienen de otra persona, el editor recarga el diagrama y muestra la actividad como una tarjeta contextual en el lienzo.
- `PRESENCE_JOINED` y `PRESENCE_LEFT` actualizan el listado de participantes. El backend autoriza a todo miembro del proyecto para conectarse; las mutaciones REST se controlan por rol.
- `DRAWING_PREVIEW` y `DRAWING_PREVIEW_CLEARED` muestran o retiran un trazo temporal mientras otra persona dibuja. `ELEMENT_INTERACTION` indica que una persona está arrastrando una clase; el borde se colorea temporalmente según esa persona. Son eventos efímeros permitidos solo para `OWNER` y `EDITOR`; no se almacenan.
