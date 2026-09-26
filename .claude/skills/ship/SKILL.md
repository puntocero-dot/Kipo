---
name: ship
description: Empaqueta el flujo completo de entrega usado en este proyecto (Kipo) para cambios de código en mobile/ — verificación de tipos, build web + prueba con Playwright, commit con atribución, push, PR, poll de CI, merge, y resincronización de la rama de trabajo contra main. Úsalo cuando el usuario pida "sube esto", "haz merge", "termina la entrega", o cuando termines una tanda de cambios de código lista para producción.
---

# /ship — flujo de entrega de Kipo

Este skill formaliza el flujo que se ha usado manualmente en cada ronda de cambios de este proyecto. No te saltes pasos salvo que el usuario lo pida explícitamente.

## 1. Verificación de tipos

```
cd mobile && npx tsc --noEmit
```

Debe salir limpio (sin errores) antes de continuar. Si hay errores, corrígelos primero.

## 2. Build web + verificación funcional con Playwright

```
cd mobile && npx expo export -p web
cd dist && python3 -m http.server 4173
```

Con el servidor corriendo, escribe un script Playwright puntual (en el directorio de scratchpad, nunca en el repo) que ejercite el camino feliz de lo que cambiaste — navega a las pantallas afectadas, interactúa con los controles nuevos/modificados, y confirma en consola (o con una captura) que no hay errores y que el comportamiento esperado ocurre. Reutiliza el patrón de scripts anteriores de esta sesión si existen en `/opt/node22/lib/node_modules/*.mjs`. Cierra el servidor HTTP al terminar.

Si el cambio es puramente de configuración (hooks, subagentes, skills, `.mcp.json`) y no toca código de `mobile/`, este paso no aplica — dilo explícitamente y sáltalo.

## 3. Revisión de migraciones (si aplica)

Si el cambio incluye una migración SQL nueva en `database/migrations/`, confirma que:
- `database/schema.sql` está sincronizado con el cambio.
- El número de migración es el siguiente consecutivo sin huecos.
- Considera invocar el subagente `supabase-rls-reviewer` si la migración toca políticas RLS.

## 4. Commit

Usa `git status` y `git diff` para confirmar qué se va a commitear — nunca `git add -A` a ciegas si hay archivos que no reconoces. Mensaje de commit conciso enfocado en el "por qué", terminado con el trailer de atribución estándar de la sesión activa (revisa el recordatorio de atribución más reciente para el texto exacto — normalmente incluye `Co-Authored-By:` y `Claude-Session:`).

## 5. Push

```
git push -u origin claude/family-finance-app-10ho25
```

Si falla por red, reintenta hasta 4 veces con backoff exponencial (2s, 4s, 8s, 16s).

## 6. Pull Request

Si no hay un PR abierto ya para esta rama contra `main`, créalo. Revisa si existe una plantilla de PR (`.github/pull_request_template.md`) y síguela si existe. Termina la descripción con el trailer de atribución de PR estándar.

## 7. Poll de CI

Este repo despliega vía Vercel. Usa las herramientas de GitHub (`pull_request_read` → `get_status`, o el MCP de GitHub disponible) para confirmar que el check de Vercel está en verde y que `mergeable_state` es `clean` antes de fusionar. Si CI falla, diagnostica y corrige — no fusiones con CI en rojo.

## 8. Merge

Fusiona el PR (squash, salvo que el usuario prefiera otro método) una vez todo esté en verde.

## 9. Resincronizar la rama de trabajo

Este paso es obligatorio tras cada merge, para evitar que la rama arrastre historial ya fusionado y genere conflictos falsos en la próxima ronda (disciplina establecida explícitamente por el usuario en esta sesión):

```
git fetch origin main
git checkout claude/family-finance-app-10ho25
git reset --hard origin/main
git push --force-with-lease
```

## 10. Confirmación

Responde al usuario en español con un resumen breve: qué se corrigió/agregó, que quedó fusionado en `main`, y cualquier cosa diferida (ej. pasos manuales que solo el usuario puede hacer, como configuración del dashboard de Supabase).
