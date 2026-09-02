# Contrato con backend

Base URL local: `http://localhost:8080/api`.

Rutas actuales:

```text
POST     /auth/register
POST     /auth/login
GET/POST /projects
GET      /projects/{id}
GET/POST /projects/{projectId}/diagrams
GET      /diagrams/{diagramId}
POST     /diagrams/{diagramId}/classes
PUT      /classes/{id}
DELETE   /classes/{id}
POST     /classes/{classId}/attributes
DELETE   /attributes/{id}
POST     /diagrams/{diagramId}/relations
DELETE   /relations/{id}
```

## Autenticación

- Registro: `name`, `email`, `password` (entre 6 y 8 caracteres) → `{ token, userId, name, email }`.
- Inicio de sesión: `email`, `password` (entre 6 y 8 caracteres) → `{ token, userId, name, email }`.
- El interceptor agrega `Authorization: Bearer <token>` a las llamadas de API.
- Las rutas de proyectos y diagramas requieren sesión. El propietario se asigna en el backend desde el JWT; `CreateProjectRequest` solo contiene `name` y `description`.
- Las relaciones de asociación, agregación y composición incluyen cardinalidad de origen y destino. Generalización representa herencia; realización y dependencia no usan cardinalidad.

El frontend debe usar los DTOs en `features/projects/models` y `features/diagram/models`. Si el backend cambia un contrato, actualizar ambos lados en la misma tarea y documentar el cambio.
