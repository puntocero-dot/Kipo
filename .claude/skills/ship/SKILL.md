---
name: ship
description: Empaqueta el flujo completo de entrega usado en este proyecto (Kipo) para cambios de código en mobile/ — verificación de tipos, build web + prueba con Playwright, commit con atribución, y push directo a main o dev. Úsalo cuando el usuario pida "sube esto", "haz merge", "termina la entrega", o cuando termines una tanda de cambios de código lista para producción.
---

# /ship — flujo de entrega de Kipo

Este skill formaliza el flujo que se ha usado manualmente en cada ronda de cambios de este proyecto. No te saltes pasos salvo que el usuario lo pida explícitamente.

## 0. Elige la rama destino — SOLO existen `main` y `dev`, siempre, sin excepción

El repo vive con **únicamente dos ramas, punto**: `main` y `dev`. No hay una tercera rama de trabajo `claude/<slug>` en este flujo — **nunca la crees**. El motivo no es de estilo: esta sesión puede crear ramas remotas pero no puede borrarlas (`git push origin --delete` devuelve 403 siempre, y no existe una herramienta de borrado de ramas en el MCP de GitHub disponible), así que cada rama `claude/*` que se crea queda ahí para siempre hasta que el usuario la borre a mano en GitHub. Crear una por cada cambio es exactamente la fricción que el usuario pidió eliminar — no la reintroduzcas.

Antes de tocar código, decide contra cuál de las dos ramas trabajas directamente:

- **Función/feature nueva** (algo que no existía) → trabaja sobre `dev`. `dev` puede acumular varios cambios relacionados antes de fusionarse a `main` cuando esté lista para producción (ese único merge sí lo puedes hacer con `git merge` local + push, sin PR).
- **Mejora de algo que ya existe, corrección de bug, o mejora de diseño/UI** → trabaja sobre `main` directo.

Si no es obvio en cuál categoría cae el pedido, pregúntale al usuario en vez de asumir. Si el usuario pide explícitamente un Pull Request para revisión, ahí sí créalo (y esa rama sí queda a cargo del usuario borrarla) — pero eso es la excepción explícita, no el flujo por default.

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

## 4. Sincroniza la rama destino antes de commitear

```
git checkout main   # o dev, según el paso 0
git pull origin main   # o dev
```

Así el commit queda sobre lo último, sin conflictos de un trabajo previo.

## 5. Commit

Usa `git status` y `git diff` para confirmar qué se va a commitear — nunca `git add -A` a ciegas si hay archivos que no reconoces. Mensaje de commit conciso enfocado en el "por qué", terminado con el trailer de atribución estándar de la sesión activa (revisa el recordatorio de atribución más reciente para el texto exacto — normalmente incluye `Co-Authored-By:` y `Claude-Session:`).

## 6. Push directo (sin PR, sin rama intermedia)

```
git push origin main   # o dev
```

Si falla por red, reintenta hasta 4 veces con backoff exponencial (2s, 4s, 8s, 16s). Si falla porque alguien más empujó algo mientras tanto, `git pull origin main --rebase` y reintenta — nunca `--force`.

## 7. Confirma el deploy de Vercel

Este repo despliega vía Vercel en cada push a `main` (no hace falta PR para que dispare). Usa `mcp__github__get_commit` (o el equivalente disponible) sobre el SHA que acabas de pushear para confirmar que el status de Vercel salió en verde. Si falla, diagnostica y corrige con un commit adicional — no dejes `main` roto.

## 8. Confirmación

Responde al usuario en español con un resumen breve: qué se corrigió/agregó, que quedó en producción (`main`), y cualquier cosa diferida (ej. pasos manuales que solo el usuario puede hacer, como configuración del dashboard de Supabase). No menciones ramas de trabajo — no existieron.
