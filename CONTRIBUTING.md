# Guía de contribución

Este proyecto mantiene **documentación viva** y **tests** que se verifican en cada commit.
Seguí este flujo al hacer cualquier cambio.

## Flujo de trabajo

1. **Hacé el cambio** en `src/` (o donde corresponda).
2. **Agregá/actualizá los tests** de lo que tocaste (ver [`docs/TESTING.md`](docs/TESTING.md)).
3. **Actualizá la documentación** si cambió una funcionalidad:
   - [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md) — la tabla de funcionalidades y el flujo.
   - [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — si cambió la estructura o el modelo de datos.
   - [`CHANGELOG.md`](CHANGELOG.md) — una entrada bajo `[Sin publicar]`.
4. **Commiteá.** El pre-commit corre solo (ver abajo).

## Qué pasa en cada commit (pre-commit hook)

El hook `.husky/pre-commit` automáticamente:

1. **Corre todos los tests** (`npm run test:run`). Si alguno falla, **el commit se cancela**.
2. **Avisa** (sin bloquear) si modificaste `src/` pero no tocaste `docs/` ni `CHANGELOG.md`,
   como recordatorio de mantener la documentación al día.

> Si necesitás saltear el hook en una emergencia: `git commit --no-verify`.
> Usalo solo como excepción.

## Principios

- **Una funcionalidad nueva = test nuevo + doc actualizada**, en el mismo commit.
- La lógica pura va en `src/lib/` para poder testearla sin React ni red.
- La documentación describe el **estado actual**, no la historia (eso es el CHANGELOG).

## Comandos útiles

```bash
npm run dev        # desarrollo
npm test           # tests en watch
npm run test:run   # tests una vez
npm run build      # build de producción
```
