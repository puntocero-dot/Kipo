---
name: ship
description: Empaqueta el flujo completo de entrega usado en este proyecto (Kipo) para cambios de código en mobile/ — verificación de tipos, build web + prueba con Playwright, commit con atribución, push, PR, poll de CI, merge, y resincronización de la rama de trabajo contra main. Úsalo cuando el usuario pida "sube esto", "haz merge", "termina la entrega", o cuando termines una tanda de cambios de código lista para producción.
---

# /ship — flujo de entrega de Kipo

Este skill formaliza el flujo que se ha usado manualmente en cada ronda de cambios de este proyecto. No te saltes pasos salvo que el usuario lo pida explícitamente.

## 0. Elige la rama base (solo existen `main` y `dev` en reposo)

El repo vive con únicamente dos ramas permanentes: `main` y `dev`. Antes de tocar código, decide contra cuál trabajas:

- **Función/feature nueva** (algo que no existía) → ramifica desde `dev`, y el PR de este cambio apunta a `dev` (no a `main`). `dev` puede acumular varios cambios relacionados antes de fusionarse a `main` cuando esté lista para producción.
- **Mejora de algo que ya existe, o de diseño/UI** → ramifica desde `main` directo, PR contra `main`, se fusiona sola sin pasar por `dev`.

En ambos casos la rama de trabajo (`claude/<slug>` que crea esta sesión) es **desechable**: se borra en cuanto su PR se fusiona (paso 9) — nunca queda una tercera rama viva. Si no es obvio en cuál categoría cae el pedido, pregúntale al usuario en vez de asumir.

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

Si el cambio incluye una migración SQL nueva en `supabase/migrations/`, confirma que:
- `database/schema.sql` está sincronizado con el cambio.
- El número de migración es el siguiente consecutivo sin huecos.
- Considera invocar el subagente `supabase-rls-reviewer` si la migración toca políticas RLS.

## 4. Commit

Usa `git status` y `git diff` para confirmar qué se va a commitear — nunca `git add -A` a ciegas si hay archivos que no reconoces. Mensaje de commit conciso enfocado en el "por qué", terminado con el trailer de atribución estándar de la sesión activa (revisa el recordatorio de atribución más reciente para el texto exacto — normalmente incluye `Co-Authored-By:` y `Claude-Session:`).

## 5. Push

```
git push -u origin <nombre-de-la-rama-de-trabajo>
```

Si falla por red, reintenta hasta 4 veces con backoff exponencial (2s, 4s, 8s, 16s).

## 6. Pull Request

Si no hay un PR abierto ya para esta rama, créalo contra la base decidida en el paso 0 (`dev` para función nueva, `main` para mejora/diseño). Revisa si existe una plantilla de PR (`.github/pull_request_template.md`) y síguela si existe. Termina la descripción con el trailer de atribución de PR estándar.

## 7. Poll de CI

Este repo despliega vía Vercel. Usa las herramientas de GitHub (`pull_request_read` → `get_status`, o el MCP de GitHub disponible) para confirmar que el check de Vercel está en verde y que `mergeable_state` es `clean` antes de fusionar. Si CI falla, diagnostica y corrige — no fusiones con CI en rojo.

## 8. Merge

Fusiona el PR (squash, salvo que el usuario prefiera otro método) una vez todo esté en verde.

## 9. Borrar la rama de trabajo (nunca queda una tercera rama viva)

Este paso es obligatorio tras cada merge — el repo solo debe tener `main` y `dev` en reposo, nunca una acumulación de ramas `claude/*` sueltas (disciplina establecida explícitamente por el usuario):

```
git push origin --delete <nombre-de-la-rama-de-trabajo>
git branch -D <nombre-de-la-rama-de-trabajo>
```

Si el PR era contra `dev` (función nueva) y `dev` sigue teniendo commits que `main` no tiene, no la borres — `dev` es permanente. Solo se borra la rama de trabajo `claude/<slug>` usada para el PR, nunca `dev` ni `main`.

## 10. Confirmación

Responde al usuario en español con un resumen breve: qué se corrigió/agregó, que quedó fusionado en `main`, y cualquier cosa diferida (ej. pasos manuales que solo el usuario puede hacer, como configuración del dashboard de Supabase).
