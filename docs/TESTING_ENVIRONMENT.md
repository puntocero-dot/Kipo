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

- Registrar tus propios gastos reales por chat — quedan guardados en el
  almacenamiento local del navegador, no se pierden al recargar la página.
- Simular alertas de SMS bancarias (pestaña **SMS**) para probar ese parser
  sin depender de una build nativa de Android.
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
este monorepo (la app vive en `mobile/`, no en la raíz). Al conectar el repo
en [vercel.com](https://vercel.com/new), Vercel lee ese archivo solo y
compila correctamente sin tocar nada más — el build corre
`npx expo export -p web` dentro de `mobile/` y publica `mobile/dist`.

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

2. **Aplica las migraciones.** Con el [Supabase CLI](https://supabase.com/docs/guides/cli)
   ya logueado y enlazado a tu proyecto (`supabase login`, `supabase init`,
   `supabase link --project-ref <tu-project-ref>`):

   ```bash
   supabase db push
   ```

   Esto aplica, en orden, los 4 archivos de `supabase/migrations/`:
   `0001_init.sql` (esquema base), `0002_category_seed.sql` (categorías del
   sistema), `0003_multi_workspace_and_rls.sql` (una persona puede tener más
   de un espacio + RLS que antes faltaba en `families`/`users`/etc.) y
   `0004_budget_category_kind.sql` (un presupuesto cubre un grupo completo de
   categorías, no una sola). Si prefieres no instalar el CLI, puedes pegar
   cada archivo, en ese mismo orden, en el **SQL Editor** del panel de
   Supabase — es el mismo SQL.

3. **(Opcional) Carga la familia de prueba "Familia Pérez".** `supabase db push`
   no corre `supabase/seed.sql` contra un proyecto remoto (ese archivo es para
   `supabase db reset` en local). Para poblar tu staging con la misma data de
   ejemplo:

   ```bash
   psql "$(npx supabase status -o env | grep DB_URL)" -f supabase/seed.sql
   # o, más simple: pega supabase/seed.sql en el SQL Editor de Supabase
   ```

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
- [ ] Módulo nativo de lectura de SMS en Android (permisos `READ_SMS`/
      `RECEIVE_SMS` ya declarados en `app.json`) — revisar la política de Play
      Store para apps que piden ese permiso sin ser el manejador de SMS
      por defecto (puede requerir justificación o el flujo alterno de
      compartir manualmente, igual que en iOS).
- [ ] Edge Function `parse-fallback` con Claude para los mensajes de baja
      confianza (prompt ya documentado en `docs/NLP_PARSING.md`).
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
