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

## Nivel 2 — Staging compartido (Supabase), para probar la sincronización familiar

1. **Crea un proyecto gratuito en [supabase.com](https://supabase.com)**
   (plan Free alcanza de sobra para pruebas). Guarda la URL del proyecto y la
   `anon key` (Project Settings → API).

2. **Aplica el esquema.** Con el [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   npx supabase login
   npx supabase link --project-ref <tu-project-ref>
   npx supabase db push          # aplica supabase/migrations/*.sql (esquema + categorías del sistema)
   ```

   Si no quieres instalar el CLI, puedes pegar el contenido de
   `database/schema.sql` y luego `database/categorySeed.sql` directamente en
   el **SQL Editor** del panel de Supabase — es el mismo SQL.

3. **(Opcional) Carga la familia de prueba "Familia Pérez".** `supabase db push`
   no corre `supabase/seed.sql` contra un proyecto remoto (ese archivo es para
   `supabase db reset` en local). Para poblar tu staging con la misma data de
   ejemplo:

   ```bash
   psql "$(npx supabase status -o env | grep DB_URL)" -f supabase/seed.sql
   # o, más simple: pega supabase/seed.sql en el SQL Editor de Supabase
   ```

4. **Conecta la app.**

   ```bash
   cd mobile
   cp .env.example .env
   # edita .env con tu URL y anon key
   ```

   `src/lib/supabase.ts` ya crea el cliente cuando esas variables existen —
   el siguiente paso de desarrollo es hacer que `src/domain/store.tsx`
   escriba en Supabase además de AsyncStorage (cola de sincronización, ver
   `docs/ARCHITECTURE.md`). Hoy el cliente está listo pero no conectado al
   store, para no bloquear las pruebas del Nivel 1 mientras se decide el
   diseño exacto de la sincronización (resolución de conflictos, qué pasa
   offline, etc. — ver `docs/ARCHITECTURE.md` § Principios de diseño).

5. **Prueba con data real de tu propia familia**, no solo con "Familia Pérez":
   borra las filas de ejemplo (`delete from families;` en cascada borra todo
   lo asociado) y da de alta tu familia real desde la app una vez esté
   conectada, o insértala directamente por SQL si prefieres arrancar ya con
   tus categorías y presupuestos reales.

## Nivel 3 — Antes de producción de verdad

Checklist de lo que falta cuando el Nivel 2 ya se sienta bien:

- [ ] Cablear `src/domain/store.tsx` a Supabase (lecturas/escrituras + cola de
      sync offline-first) en vez de solo AsyncStorage.
- [ ] Suscripción a Supabase Realtime por `family_id` para que los cambios de
      un miembro aparezcan en el dispositivo del otro sin recargar.
- [ ] Edge Function `check-budgets` + `send-reminders` (cron diario) y
      Expo Push para las notificaciones — hoy son solo alertas dentro de la app.
- [ ] Módulo nativo de lectura de SMS en Android (permisos `READ_SMS`/
      `RECEIVE_SMS` ya declarados en `app.json`) — revisar la política de Play
      Store para apps que piden ese permiso sin ser el manejador de SMS
      por defecto (puede requerir justificación o el flujo alterno de
      compartir manualmente, igual que en iOS).
- [ ] Edge Function `parse-fallback` con Claude para los mensajes de baja
      confianza (prompt ya documentado en `docs/NLP_PARSING.md`).
- [ ] Auditoría de RLS: confirmar que cada `auth_user_id` de Supabase Auth
      quede correctamente vinculado a su fila en `users` al registrarse
      (hoy los usuarios de `supabase/seed.sql` no tienen `auth_user_id`,
      es solo data de prueba).
- [ ] `eas build` firmado + revisión de permisos declarados antes de subir a
      Play Store / App Store.

## Resumen de qué usar cuándo

| Quiero... | Usa |
|---|---|
| Ver la app funcionando ya, hoy | Nivel 1 (`npm run web`) |
| Que dos personas prueben con los mismos datos | Nivel 2 (Supabase staging) |
| Publicar en las tiendas | Nivel 3 |
