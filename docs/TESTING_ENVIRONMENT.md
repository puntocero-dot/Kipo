# Kipo — Ambiente de pruebas antes de producción

Este documento conecta las dos piezas que ya existen en el repo — la app
(`mobile/`) y el esquema de base de datos (`database/`, `supabase/`) — en un
plan concreto para probar Kipo con datos reales antes de invertir en el
lanzamiento en tiendas.

## Nivel 1 — Ahora mismo, sin nada que instalar además de Node

La app corre local, sin backend, con datos de prueba realistas ya cargados:

```bash
cd mobile
npm install
npm run web
```

Esto abre Kipo en el navegador. Puedes:

- Registrar tus propios gastos reales hablando con Kipobot (chat con IA) —
  quedan guardados en el almacenamiento local del navegador, no se pierden al
  recargar la página. Sin `GEMINI_API_KEY` configurada, cae automáticamente
  al parser local por reglas — sigue funcionando, solo sin las preguntas de
  aclaración.
- Corregir categorías sugeridas y ver cómo la app "aprende" la corrección.
- Ver el dashboard, presupuestos y recordatorios reaccionar a esos datos.

**Limitación de este nivel:** los datos viven en un solo dispositivo/navegador
— no hay forma de que dos miembros de la familia vean los mismos gastos
todavía. Para eso sigue el Nivel 2.

`npm start` en vez de `npm run web` te da un código QR para abrirla con la
app **Expo Go** en un celular real — igual de local, pero en el dispositivo
donde de verdad vas a usarla.

### Publicar esta versión web en un link real (Vercel)

El repo ya trae [`vercel.json`](../vercel.json) en la raíz configurado para
este monorepo. Desde que existe la landing de marketing (`landing/`), el
dominio raíz sirve esa landing estática y la app (Expo web export) vive bajo
`/app/*` en el mismo dominio — el build corre `npx expo export -p web` dentro
de `mobile/` con `EXPO_WEB_BASE_PATH=/app` y copia el resultado a
`landing/public/app/` antes de publicar `landing/public` completo. Al
conectar el repo en [vercel.com](https://vercel.com/new), Vercel lee ese
archivo solo y compila correctamente sin tocar nada más.

Si ya tenías un proyecto de Vercel conectado a este repo desde **antes** de
que existiera `vercel.json` (por eso el 404 `NOT_FOUND` la primera vez: no
sabía qué construir), hace falta un redeploy para que recoja el archivo
nuevo:

1. En el dashboard de Vercel → tu proyecto → **Deployments**.
2. Al último deploy (o a `main`/la rama conectada) → menú `···` → **Redeploy**.
3. Si sigue fallando, revisa en **Settings → Build & Development Settings**
   que "Root Directory" esté en blanco/`.` (raíz del repo) — `vercel.json` ya
   asume que corre desde ahí, no desde `mobile/`.

Verificado localmente antes de este commit: `cd mobile && npx expo export -p web`
compila sin errores y el resultado en `mobile/dist` sirve la app idéntica a
`npm run web` (probado con un servidor estático local).

## Nivel 2 — Backend real (Supabase): login, multi-cliente y multi-espacio

Esto ya está cableado de verdad (no es solo el esquema) — `mobile/` incluye
login real, aislamiento por cliente y que una misma persona tenga más de un
espacio de trabajo. Ver `docs/ARCHITECTURE.md` para el porqué, y
`mobile/README.md` § "Qué es real y qué es simulado" para el detalle exacto
de qué corre contra Postgres y qué sigue siendo local.

1. **Crea un proyecto gratuito en [supabase.com](https://supabase.com)**
   (plan Free alcanza de sobra para pruebas). Guarda la URL del proyecto y la
   `anon key` (Project Settings → API).

2. **Aplica las migraciones.** No usamos el Supabase CLI para esto — pega
   cada archivo de `supabase/migrations/`, **en orden numérico** (`0001_...`
   hasta el más reciente), en el **SQL Editor** del panel de Supabase.
   `database/schema.sql` es la foto acumulada de todas las migraciones
   aplicadas hasta hoy, útil como referencia rápida del esquema completo sin
   tener que sumar cada archivo mentalmente.

   **Si en algún momento reseteas el schema `public` a mano**
   (`drop schema public cascade; create schema public;`) para volver a pegar
   `database/schema.sql` completo de una sola vez: eso borra también los
   privilegios de tabla que Supabase le da por defecto a `anon`/
   `authenticated` cuando crea el proyecto — sin ellos, la REST API responde
   401/403 en todo aunque las políticas RLS estén bien. `database/schema.sql`
   ya repone esos privilegios al inicio (ver `0025_restore_public_grants.sql`
   si necesitas aplicarlo suelto sobre un proyecto que ya tenías migrado).

3. **(Opcional) Carga la familia de prueba "Familia Pérez".** Pegar las
   migraciones en el SQL Editor no incluye `supabase/seed.sql` (ese archivo
   es aparte, pensado para `supabase db reset` en local o para correrlo a
   mano contra staging). Para poblar tu staging con la misma data de
   ejemplo:

   Pega el contenido de `supabase/seed.sql` en el SQL Editor de Supabase y
   ejecútalo (o, si tienes el Supabase CLI enlazado al proyecto:
   `psql "$(npx supabase status -o env | grep DB_URL)" -f supabase/seed.sql`).

   Como esos usuarios de prueba no tienen `auth_user_id` (no son cuentas
   reales), no vas a poder "iniciar sesión como ellos" — son solo para
   mirar los datos en el SQL Editor o probar consultas, no para el flujo de
   login de la app.

4. **Conecta la app.**

   ```bash
   cd mobile
   cp .env.example .env
   # edita .env con tu URL y anon key
   npm run web
   ```

   Con esas variables presentes, la app ya no muestra "Familia Pérez" fija:
   pide iniciar sesión o crear cuenta (Supabase Auth), y luego **crear un
   espacio nuevo** o **unirte con un código de invitación**. Cada espacio es
   una fila de `families`, aislada de las demás por RLS — así vendes a más
   de un cliente sin que se vean los datos entre sí. Si la misma persona
   crea un segundo espacio (ej. sus finanzas personales aparte de su
   familia), puede alternar entre ellos desde **Más → Cambiar de espacio**.

5. **Prueba la sincronización real:** abre la app en dos pestañas/dispositivos
   con la misma cuenta (o invita a alguien más con el código), registra un
   gasto en una y debería aparecer en la otra sola — es Supabase Realtime,
   no hay que recargar. Nota: no hay cola offline todavía, así que sin
   conexión una escritura simplemente falla (queda para el Nivel 3).

## Nivel 3 — Antes de producción de verdad

Checklist de lo que falta cuando el Nivel 2 ya se sienta bien:

- [ ] Cola de sincronización offline-first en `src/domain/supabaseStore.tsx`
      (hoy, sin red, una escritura falla en vez de encolarse — ver
      `docs/ARCHITECTURE.md`).
- [ ] Edge Function `check-budgets` + `send-reminders` (cron diario) y
      Expo Push para las notificaciones — hoy son solo alertas dentro de la app.
- [x] ~~Módulo nativo de lectura de SMS en Android~~ — se quitó por completo
      (permiso, pantalla y tabla `sms_inbox`); reemplazado por Kipobot, ver
      `docs/NLP_PARSING.md` §2 y `api/parse-expense.js`.
- [ ] Configurar `GEMINI_API_KEY` en las variables de entorno de Vercel para
      que Kipobot (captura de gastos y el bot de la landing) funcione en
      producción — sin ella, ambos caen a su respaldo (parser local / mensaje
      de contacto).
- [ ] Facturación (Stripe u otro) si vas a cobrar por espacio/familia — el
      aislamiento multi-cliente ya existe, falta la parte de cobro.
- [ ] `eas build` firmado + revisión de permisos declarados antes de subir a
      Play Store / App Store.

## Resumen de qué usar cuándo

| Quiero... | Usa |
|---|---|
| Ver la app funcionando ya, hoy | Nivel 1 (`npm run web`) |
| Vender a varios clientes, o tener yo mismo varios espacios | Nivel 2 (Supabase real) |
| Publicar en las tiendas | Nivel 3 |
