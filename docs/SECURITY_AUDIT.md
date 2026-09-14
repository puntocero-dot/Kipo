# Auditoría de seguridad — Kipo

Fecha: 2026-09-14 · Alcance: infraestructura (Vercel + Supabase), backend (Postgres/RLS), frontend (Expo/React Native Web).

## Resumen ejecutivo

Se encontró **un hallazgo crítico real y explotable en producción**: cualquier usuario autenticado podía auto-promoverse a administrador de su familia, o unirse a **cualquier otra familia sin código de invitación**, editando su propia fila con una llamada directa a la API de Supabase (sin pasar por la UI). Ya está corregido (migración `0006_security_hardening.sql`) y probado. El resto de hallazgos son de severidad media/baja — se documentan con su corrección o la acción manual pendiente.

**Antes de nada, hay una acción que solo tú puedes hacer y es la más urgente de todo este documento:** ver §1 de "Acciones manuales pendientes" — la `service_role` key de Supabase se compartió en texto plano en esta conversación en una sesión anterior. Si no la has rotado ya, un usuario que solo lea ese texto tiene acceso total a la base de datos, sin pasar por RLS. Esto no se puede arreglar con código, solo desde el dashboard.

---

## 1. Hallazgos y correcciones aplicadas

| # | Hallazgo | Severidad | Dónde | Estado |
|---|---|---|---|---|
| 1 | `users_update_own_row` no restringía qué columnas se pueden cambiar — un miembro podía poner `role='admin'` o `family_id=<cualquier familia>` en su propia fila | **Crítica** | RLS (`0003`) | ✅ Corregido — trigger `prevent_users_privilege_escalation` en `0006` |
| 2 | `visible_categories` y `family_isolation_categorization_rules` permitían INSERT/UPDATE/DELETE sobre el catálogo global (`family_id is null`), no solo lectura | Media | RLS (`0003`) | ✅ Corregido — separadas en policies de SELECT vs. escritura en `0006` |
| 3 | Sin cabeceras de seguridad HTTP (CSP, X-Frame-Options, HSTS, etc.) — la app quedaba abierta a clickjacking y sin política de origen para scripts/estilos | Media | `vercel.json` | ✅ Corregido — probado que la CSP no rompe el renderizado (react-native-web necesita `style-src 'unsafe-inline'`, ya incluido) |
| 4 | Contraseña mínima de 6 caracteres | Baja | `AuthScreen.tsx` | ✅ Corregido — mínimo 8 |
| 5 | 13 vulnerabilidades "moderate" en `npm audit` | Baja | dependencias de build de Expo (`@expo/cli`, `xcode`, etc.) | ℹ️ No aplica al bundle que se sirve — son herramientas de build/EAS, no código que llega al navegador. Se resuelven solo con un salto mayor de versión de Expo (no recomendado hacerlo solo por esto); se listan para que quede en el radar |
| 6 | Un miembro de familia puede reasignar el `user_id` de una transacción ajena a otro miembro de la misma familia | Baja | RLS (`transactions`) | 📋 Documentado, no corregido — es dentro del mismo círculo de confianza (la familia ya comparte todos sus datos); si en el futuro esto importa, se resuelve con una policy de UPDATE separada que excluya la columna `user_id` |
| 7 | El token de sesión de Supabase vive en `localStorage` del navegador (comportamiento por defecto del SDK) | Baja | Frontend | 📋 Aceptable — es el modelo estándar de Supabase-js para apps sin backend propio; mitigación real es evitar XSS (React ya escapa por defecto, no hay `dangerouslySetInnerHTML` en el código) |

## 2. "Puertos y accesos"

Vale la pena ser explícito aquí: **Kipo no tiene servidores propios que escuchen en un puerto.** El frontend es un sitio estático en Vercel y el backend es Supabase (Postgres + Auth + Realtime, todo administrado). No hay un firewall que configurar ni un `22`/`5432` expuesto por ustedes — esa superficie no existe en esta arquitectura. Lo que sí es equivalente a "puertos y accesos" aquí:

- **La API REST/Realtime de Supabase** (pública por diseño) — su único control de acceso es RLS. Por eso el hallazgo #1 era crítico: no es que "alguien entrara por un puerto abierto", es que la puerta correcta (RLS) tenía una cerradura mal puesta.
- **La conexión directa a Postgres** (puerto 5432/6543 del pooler) — confirmado que el código no la usa en ningún lado (solo se conecta vía el SDK de Supabase con la `anon key`). Nunca debe usarse esa cadena de conexión directa desde el cliente; si en el futuro necesitan un script de administración, debe correr desde un entorno que ustedes controlen, nunca embebido en la app.
- **CORS del proyecto de Supabase** — no se puede verificar ni cambiar desde el código, solo desde el dashboard (Settings → API). Ver acción manual §4.

## 3. Acciones manuales pendientes (dashboard, no se resuelven con código)

Ordenadas por sensibilidad — la primera es la más urgente de todo este documento:

1. **Rotar la `service_role` key** si no se ha hecho: Settings → API → "Reset" junto al secreto de `service_role`. Esa clave se compartió en texto plano en esta conversación; aunque nunca se usó en el código de la app, cualquiera con acceso a este chat la tiene. Rotarla invalida la anterior sin afectar a los usuarios (la `anon key` pública no cambia).
2. **Activar protección contra contraseñas filtradas** y subir el mínimo a 8 caracteres también del lado del servidor: Authentication → Policies → Password settings (el código ya pide 8, pero Supabase debe exigirlo también, por si alguien llama la API directo).
3. **Volver a activar "Confirm email"** en Authentication → Providers → Email — se desactivó temporalmente durante las pruebas de este proyecto; en producción, sin esto, cualquiera puede registrarse con un correo que no le pertenece.
4. **Revisar CORS / Allowed origins** en Settings → API — debe listar únicamente el dominio de producción en Vercel (y el de preview si lo usan), nunca `*`.
5. **Activar CAPTCHA (hCaptcha)** en Authentication → Settings — ayuda contra ataques de fuerza bruta / creación masiva de cuentas falsas.
6. **Backups / Point-in-Time Recovery** — Settings → Database → Backups. Para una app de finanzas, tener backups automáticos no es opcional.

## 4. "Bloqueo de usuarios en caso de hackeo" — qué existe hoy y qué falta

Hoy, si detectan una cuenta comprometida o un miembro que hay que sacar de inmediato:

- **Deshabilitar/eliminar la cuenta**: Authentication → Users → buscar por correo → "Ban user" (o eliminarla). Esto corta el acceso al instante, sin pasar por la app — es la acción correcta ante un incidente real, y ya está disponible sin ningún cambio de código.
- **Forzar cierre de sesión en todos los dispositivos**: el mismo panel de Authentication → Users permite revocar las sesiones activas de un usuario.
- **Rotar el `invite_code` de una familia comprometida**: hoy no hay botón en la app para esto — se hace con un `UPDATE families SET invite_code = ... WHERE id = '<id>'` desde el SQL Editor de Supabase. Si esto se vuelve algo que necesitan hacer seguido, vale la pena construir un botón de "regenerar código" en la pantalla de Familia (no lo until se pidió explícitamente en este momento, para no meter una función nueva dentro de una tarea de seguridad).

Lo que NO existe todavía y sí sería construir código (no lo hice en esta pasada porque es una función nueva, no una corrección — avísame si la quieres): un botón dentro de la propia app para que un admin de familia suspenda a otro miembro sin tener que entrar al dashboard de Supabase. Técnicamente requeriría una Edge Function (la API de administración de usuarios de Supabase exige la `service_role` key, que nunca debe tocar el cliente).

## 5. Rendimiento (revisión posterior a los cambios de esta sesión)

- El bundle web creció de ~1.6MB a ~2.1MB al agregar las fuentes (Outfit + Plus Jakarta Sans) y el set de íconos (Ionicons). Es esperable y no es un problema al tamaño actual del proyecto; si en el futuro se vuelve notorio, lo primero a revisar es cargar solo los pesos de fuente que realmente se usan (hoy se cargan 4 de Outfit y 4 de Plus Jakarta Sans, que ya es el mínimo razonable).
- Índices de base de datos: `transactions` tiene índice compuesto por `(family_id, occurred_at desc)` — correcto para el query más frecuente (historial ordenado por fecha). `sms_inbox` tiene índice parcial solo sobre `pendiente` — bien pensado.
- El patrón de sincronización en tiempo real (`supabaseStore.tsx`) recarga **todas** las tablas de la familia (`loadAll()`) ante cualquier cambio en transacciones, presupuestos, recordatorios o miembros. Con el volumen de datos actual esto es imperceptible; si una familia llega a tener miles de transacciones, conviene cambiar a actualizar solo la fila que cambió en vez de recargar todo. No es urgente hoy.

## 6. Recomendaciones de mantenimiento continuo

- Correr `npm audit` una vez al mes; actuar solo sobre "high"/"critical" a menos que un "moderate" esté en una dependencia que sí llega al navegador.
- Cualquier clave o token nuevo (de un servicio de pagos, de notificaciones push, etc.) va a `EXPO_PUBLIC_*` **solo** si de verdad debe ser pública (como la `anon key`); todo lo demás nunca debe empezar con `EXPO_PUBLIC_` porque Expo lo embebe literalmente en el JS que descarga el navegador.
- Cada tabla nueva en Postgres necesita RLS habilitado y una policy explícita desde el día uno de la migración que la crea — no después. El hallazgo #1 de este documento pasó precisamente porque una policy se escribió pensando solo en el caso de uso feliz ("edita su propio nombre") sin pensar en qué más permite un UPDATE sin restricciones de columna.
- Antes de escribir una policy de RLS, preguntarse explícitamente: "¿qué pasa si el usuario cambia una columna que no debería?" — no solo "¿puede ver/tocar la fila?".
