# AGENTS.md — Frontend Angular

Este archivo es obligatorio para cualquier IA que trabaje en `_frontend`. Leer primero `agents/`.

## Lectura y decisión obligatorias

Antes de modificar código, leer `agents/00_CONTEXTO.md`, `01_ARQUITECTURA.md`,
`02_CALIDAD.md`, `03_CONTRATO_BACKEND.md`, `04_HOJA_DE_RUTA_FRONTEND.md` y
`05_ESTANDAR_CALIDAD.md`.

No improvisar decisiones de producto, contratos, seguridad, persistencia o UX que
no estén definidos. Si la respuesta no está en el código o en estos documentos,
detenerse y preguntar a la persona responsable.

## Misión

Construir un frontend Angular de alta calidad para UMLink. Debe ser claro, accesible, testeable y respetar el contrato del backend Spring Boot.

## Arquitectura

```text
src/app/
├── core/       # configuración e infraestructura global
├── shared/     # UI reutilizable sin lógica de dominio
└── features/   # funcionalidades aisladas: projects, diagram, collaboration
```

Cada feature expone su API pública mediante `index.ts`. No crear barriles globales que generen dependencias circulares.

## Calidad no negociable

- Componentes standalone, tipado estricto y templates simples.
- Ninguna URL HTTP escrita fuera de `core/config`.
- Servicios de API en `data-access`; páginas y componentes no construyen URLs.
- No usar `any`, suscripciones sin limpiar ni lógica de negocio duplicada.
- Probar los cambios y ejecutar `npm run build` antes de terminar.
- No incluir secretos, tokens ni configuraciones inseguras.

## Hoja de ruta obligatoria

La implementación se realiza por fases y no se salta una fase sin validarla.
Leer `agents/04_HOJA_DE_RUTA_FRONTEND.md` antes de comenzar una funcionalidad.
La prioridad visual definida es: interfaz moderna, fondos blancos, paleta de azules,
experiencia intuitiva y comportamiento responsive.

## Cierre obligatorio de una tarea

Al finalizar, informar: objetivo realizado, archivos relevantes, comportamiento,
verificación ejecutada y limitaciones pendientes. Marcar con `[x]` únicamente las
tareas terminadas y probadas en la hoja de ruta.

## Comandos

```powershell
npm run build
npm test
npm start
```
