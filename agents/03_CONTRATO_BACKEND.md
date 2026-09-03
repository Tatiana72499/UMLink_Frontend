# Contrato con backend

Base URL local: `http://localhost:8080/api`.

Rutas actuales:

```text
POST     /auth/register
POST     /auth/login
GET/POST /projects
GET      /projects/{id}
PUT      /projects/{id}
DELETE   /projects/{id}?version={version}
GET/POST /projects/{projectId}/diagrams
GET      /diagrams/{diagramId}
PUT      /diagrams/{diagramId}
DELETE   /diagrams/{diagramId}?version={version}
POST     /diagrams/{diagramId}/classes
PUT      /classes/{id}
DELETE   /classes/{id}
POST     /classes/{classId}/attributes
PUT      /attributes/{id}
DELETE   /attributes/{id}
POST     /diagrams/{diagramId}/relations
POST     /diagrams/{diagramId}/association-classes
PUT      /relations/{id}
PUT      /relations/{id}/cardinality
DELETE   /relations/{id}
```

## Autenticación

- Registro: `name`, `email`, `password` (entre 6 y 8 caracteres) → `{ token, userId, name, email }`.
- Inicio de sesión: `email`, `password` (entre 6 y 8 caracteres) → `{ token, userId, name, email }`.
- El interceptor agrega `Authorization: Bearer <token>` a las llamadas de API.
- Las rutas de proyectos y diagramas requieren sesión. El propietario se asigna en el backend desde el JWT; `CreateProjectRequest` solo contiene `name` y `description`.
- Las respuestas de proyecto y diagrama incluyen `version`. Para actualizar, el frontend envía la versión recibida; para eliminar, la envía como parámetro `version`. Si recibe `409 VERSION_CONFLICT`, debe recargar el recurso antes de permitir otro intento.
- Las relaciones de asociación, agregación y composición incluyen cardinalidad de origen y destino. Las únicas opciones son `1..1`, `0..1` y `1..*`. Generalización representa herencia; realización y dependencia no usan cardinalidad.
- `PUT /relations/{id}/cardinality` recibe `{ sourceCardinality, targetCardinality }`; solo aplica a asociación, agregación y composición y conserva las clases y el tipo de la relación.
- `PUT /attributes/{id}` actualiza nombre, tipo y visibilidad. `PUT /relations/{id}` actualiza sus extremos, tipo y cardinalidades validadas.
- Los tipos de atributo permitidos son String, Integer, Long, Double, Boolean, UUID, LocalDate y LocalDateTime. Las clases exponen `fillColor` (nulo significa sin relleno) y las relaciones `label` para asociación, agregación, composición y dependencia.
- Las relaciones exponen `alignmentPoints`, una lista ordenada de hasta 20 puntos `{x, y}` para alinear manualmente el conector. Se mantienen `bendX` y `bendY` solo por compatibilidad. Una asociación puede incluir `associationClassId` para vincular una tercera clase del mismo diagrama; no puede ser una de las dos clases que conecta.
- `POST /diagrams/{diagramId}/association-classes` recibe dos clases, nombre, posición y color; crea en una sola transacción la asociación muchos-a-muchos sin cardinalidades visibles junto con su clase intermedia, y devuelve ambos elementos.

El frontend debe usar los DTOs en `features/projects/models` y `features/diagram/models`. Si el backend cambia un contrato, actualizar ambos lados en la misma tarea y documentar el cambio.
