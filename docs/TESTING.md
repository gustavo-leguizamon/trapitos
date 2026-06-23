# Testing

## Stack

- **[Vitest](https://vitest.dev/)** — runner de tests (comparte config con Vite).
- **@testing-library/react** — render y consultas de componentes.
- **@testing-library/user-event** — simular interacciones del usuario.
- **jsdom** — entorno tipo navegador para los tests.

## Comandos

```bash
npm test          # modo watch (re-corre al guardar)
npm run test:run  # corre una vez (lo que usa el pre-commit y el CI)
npm run test:ui   # interfaz visual de Vitest
```

## Convenciones

- Los tests viven **al lado del archivo** que prueban: `geo.js` → `geo.test.js`.
- Extensión `.test.js` para lógica pura, `.test.jsx` para componentes.
- La lógica pura (sin React/red) va en `src/lib/` para poder testearla aislada.
- Para hooks usamos `renderHook`; para componentes, `render` + queries por rol/texto.
- Dependencias externas (GPS, Supabase, Leaflet) se **mockean** con `vi.fn()`/`vi.stubGlobal`.

## Qué hay cubierto hoy

| Archivo | Cubre |
|---------|-------|
| `src/lib/geo.test.js` | `toPointWKT` (orden lng/lat) y `paddedRadius` (radio + mínimo) |
| `src/hooks/useGeolocation.test.js` | GPS ok, permiso rechazado, sin soporte |
| `src/components/AddSpotForm.test.jsx` | render, submit (trim), cancelar, estado "guardando" |

## Regla de oro

> Al **agregar o cambiar** una funcionalidad, agregá/actualizá su test en el mismo
> commit. El pre-commit corre toda la batería: si algo se rompe, el commit se aborta.

### Cómo testear funcionalidad nueva
1. Si hay lógica pura, ponela en `src/lib/` y testeala directo.
2. Si es UI, testeá el comportamiento observable (qué ve y hace el usuario), no el detalle interno.
3. Si toca Supabase, mockeá el cliente y verificá que se llama con los argumentos correctos.
