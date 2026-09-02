# Arquitectura frontend

- `core`: tokens de configuración, interceptores, guards y recursos singleton.
- `shared`: componentes visuales, pipes y directivas que no dependen de un dominio.
- `features/<nombre>/models`: contratos TypeScript.
- `features/<nombre>/data-access`: llamadas HTTP o WebSocket.
- `features/<nombre>/pages`: componentes asociados a rutas.
- `index.ts`: barril público del feature o carpeta; exportar solo elementos estables.

Las páginas usan servicios de `data-access`; no llaman `HttpClient` directamente.
