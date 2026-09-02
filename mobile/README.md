# Kipo — app (Expo / React Native)

Implementación funcional del diseño en `../docs/`: captura de gastos en
lenguaje natural, bandeja de SMS simulados, dashboard, presupuestos y
recordatorios — corriendo 100% local (sin backend) con datos de prueba
realistas, lista para conectarse a Supabase cuando quieras compartir data
entre dispositivos de la familia (ver `../docs/TESTING_ENVIRONMENT.md`).

## Correr en modo pruebas (recomendado para visualizar ya)

```bash
npm install
npm run web       # abre en el navegador — sirve para ver y probar la app YA
# o
npm start         # muestra un QR: escanéalo con la app Expo Go en tu celular
```

La primera vez que abre, la app se siembra sola con datos de ejemplo de
"Familia Pérez" (dos meses de gastos, presupuestos, recordatorios y 2 SMS
pendientes) guardados en el almacenamiento local del navegador/dispositivo.
Todo lo que registres además de eso (tus propios gastos reales) también
queda guardado ahí — es data real tuya, solo que vive en este dispositivo
hasta que conectes el backend de staging.

Desde la pestaña **Más → Reiniciar datos de prueba** puedes volver a la
data de ejemplo en cualquier momento.

## Qué es real y qué es simulado en este ambiente

| Función | Estado |
|---|---|
| Parser de lenguaje natural (monto/categoría/contexto social) | **Real** — el mismo código de `../src/parsing` |
| Guardado de transacciones, presupuestos, recordatorios | **Real** — persistido en AsyncStorage (local) |
| Aprendizaje por corrección de categoría | **Real** — genera reglas por familia |
| Lectura de SMS bancarios en segundo plano | **Simulado** — solo funciona en una build nativa de Android; aquí hay un botón para "inyectar" un SMS de prueba y ver el mismo parser en acción |
| Dictado por voz | **Pendiente** — requiere `expo-speech-recognition` en una build nativa, no wireado todavía |
| Sincronización entre miembros de la familia | **Pendiente** — el esquema y el cliente de Supabase (`src/lib/supabase.ts`) están listos; falta conectar el store a un proyecto real (ver `../docs/TESTING_ENVIRONMENT.md`) |
| Notificaciones push de recordatorios/presupuestos | **Pendiente** — hoy se muestran como alertas dentro de la app (dashboard); Expo Push + Edge Function es el siguiente paso de producción |

## Estructura

```
app/                  pantallas (expo-router: cada archivo es una ruta)
src/domain/           estado (store.tsx), tipos, selectores, datos semilla
src/components/       UI reutilizable (dona, barras de presupuesto, tarjetas)
src/lib/supabase.ts   cliente de Supabase (inactivo hasta configurar .env)
../src/parsing/       parser compartido con el resto del repo (no se duplica)
```

## Compilar para producción

```bash
npx eas login
npx eas build:configure
npx eas build --platform android   # o ios
```

Antes de una build de producción real: revisar los permisos `READ_SMS`/
`RECEIVE_SMS` declarados en `app.json` — Google Play restringe estos permisos
a apps que sean el manejador de SMS por defecto, así que probablemente haga
falta justificar el uso ante Play Store o usar un flujo alterno (compartir el
SMS manualmente, igual que en iOS). Ver `../docs/NLP_PARSING.md`.
