# UMLink Frontend

Cliente web de **UMLink**, una herramienta colaborativa para diseñar diagramas de clases UML. Esta primera versión se centra en una experiencia clara y responsive para autenticarse, gestionar proyectos y modelar clases, atributos y relaciones.

## Capacidades actuales

- Registro e inicio de sesión con validaciones claras.
- Gestión de proyectos vinculados a su creador.
- Editor de diagramas de clases con lienzo, cuadrícula y diseño responsive.
- Creación de clases y atributos desde el panel de propiedades.
- Relaciones UML: asociación, agregación, composición, generalización, realización y dependencia.
- Cardinalidades para asociación, agregación y composición.
- Arrastre de clases sobre el lienzo y persistencia de su posición en el backend.

## Tecnologías

- Angular con componentes *standalone* y TypeScript estricto.
- SCSS para el sistema visual.
- Angular HttpClient para consumir la API Spring Boot.
- Pruebas unitarias con Vitest.

## Requisitos

- Node.js LTS y npm.
- Backend UMLink ejecutándose en `http://localhost:8080`.
- PostgreSQL configurado para el backend.

## Ejecutar el proyecto

Desde PowerShell, en esta carpeta:

```powershell
npm.cmd install
npm.cmd start
```

Luego abre [http://localhost:4200](http://localhost:4200).

> Si PowerShell bloquea `npm.ps1`, usa `npm.cmd` como en los comandos anteriores. El backend debe permitir el origen `http://localhost:4200` mediante CORS.

## Calidad y verificación

Antes de enviar cambios, ejecuta:

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

El proyecto mantiene TypeScript estricto, separación por funcionalidades, acceso HTTP concentrado en servicios API y pruebas para los flujos principales. Consulta `AGENTS.md` y la carpeta `agents/` antes de modificar el código: contienen la arquitectura, contrato con backend, estándares de calidad y hoja de ruta.

## Estructura principal

```text
src/app/
├── core/             # configuración, sesión y servicios transversales
├── features/         # autenticación, proyectos y editor de diagramas
├── shared/           # componentes y utilidades reutilizables
└── app.routes.ts     # rutas de la aplicación
```

Cada funcionalidad conserva sus modelos, servicios API, páginas y pruebas cercanas entre sí. No se deben agregar URLs de API fuera de la configuración central ni lógica de red en componentes visuales.

## Convenciones de commits sugeridas

```text
feat(diagram): agrega creación de clases UML
fix(diagram): valida clases dentro del diagrama
test(diagram): cubre creación de relaciones
docs: actualiza instrucciones de arquitectura
```

Usa mensajes en imperativo, breves y con un alcance específico. Los prefijos recomendados son `feat`, `fix`, `test`, `docs`, `refactor`, `style` y `chore`.

## Estado y siguientes mejoras

La hoja de ruta en `agents/04_HOJA_DE_RUTA_FRONTEND.md` es la fuente de verdad del avance. Solo se marca una tarea como completada cuando está implementada y verificada. Próximas iteraciones previstas: edición/eliminación de elementos, controles avanzados de conectores, persistencia colaborativa y exportación/importación de diagramas.
