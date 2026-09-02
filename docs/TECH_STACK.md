# Kipo — Stack tecnológico recomendado

## Resumen

| Capa | Elección | Por qué |
|---|---|---|
| App móvil | **React Native + Expo (TypeScript)** | Un solo código para iOS/Android, EAS Build para releases, gran ecosistema de módulos nativos (SMS, voz, notificaciones) |
| Base de datos local | **SQLite** vía `expo-sqlite`/`op-sqlite` + **Drizzle ORM** | Offline-first real, tipado end-to-end, migraciones simples, funciona sin red desde el día uno |
| Backend | **Supabase** (Postgres + Auth + Realtime + Edge Functions + Storage) | Modelo relacional (calza con el esquema diseñado), Row Level Security nativo para aislar familias, Realtime para sincronizar entre miembros sin infraestructura propia |
| Sincronización | Cola local (`sync_log`) + Supabase Realtime | Escritura instantánea local; subida en segundo plano; cambios de otros miembros llegan por suscripción, no por polling |
| NLP de captura | Reglas locales (`src/parsing/*`) + **Claude Haiku** como fallback vía Edge Function | Instantáneo y gratis para el caso común; LLM solo para texto ambiguo, sin exponer la API key en el cliente |
| Notificaciones push | **Expo Push Notifications** + Edge Function programada (cron) | Cubre recordatorios de pago y alertas de presupuesto sin servidor propio |
| Voz a texto | `expo-speech-recognition` (o `@react-native-voice/voice`) | Dictado nativo del sistema operativo, sin costo de API |
| Lectura de SMS | Módulo nativo Android (`READ_SMS`/`RECEIVE_SMS`) + Share Extension en iOS | Ver limitación de plataforma en `docs/NLP_PARSING.md` — iOS no permite lectura de SMS en segundo plano por apps de terceros |
| Gráficos del dashboard | `victory-native` o `react-native-svg` + `react-native-svg-charts` | Livianos, se ven bien en ambas plataformas, suficientes para dona/barras |

## Por qué offline-first con Supabase (y no Firebase)

El esquema de datos es intrínsecamente **relacional** (familias → usuarios →
transacciones → categorías → presupuestos, con múltiples llaves foráneas y
reglas de negocio tipo "un presupuesto agrupa varias categorías"). Postgres
modela esto de forma natural con integridad referencial y RLS declarativo;
Firestore (NoSQL) obligaría a desnormalizar y replicar lógica de aislamiento
por familia a mano en reglas de seguridad más difíciles de auditar. Supabase
además da Postgres administrado + Auth + Realtime + Edge Functions (Deno) en
una sola plataforma, lo que reduce piezas de infraestructura a mantener para
un equipo pequeño.

## Por qué reglas locales antes que un LLM para el parsing

Los ejemplos del pedido ("Gasolina carro $40", "Cervezas con amigos $20") son
justo el tipo de texto corto y estructurado que un diccionario de palabras
clave resuelve con 100% de exactitud, cero costo y cero latencia de red — algo
crítico porque la app debe funcionar sin conexión (ej. registrar un gasto
mientras se está pagando en una tienda sin señal). Reservar el LLM para el
subconjunto de mensajes ambiguos mantiene el costo operativo bajo y la
experiencia rápida incluso offline.

## Alternativas consideradas

- **Flutter + Firebase**: viable y también cross-platform, pero el modelo de
  datos relacional del pedido (categorías jerárquicas, presupuestos por
  categoría, recordatorios) se expresa con más naturalidad en SQL que en
  Firestore. Si el equipo ya tiene experiencia fuerte en Flutter/Firebase, es
  una alternativa razonable — el diseño de base de datos y la lógica de
  parsing de este documento se trasladan igual (Firestore como capa de
  sincronización, SQLite/`sqflite` local para offline).
- **WatermelonDB** en lugar de Drizzle+SQLite: mejor si se necesita sync
  reactivo "out of the box" con resolución de conflictos más sofisticada;
  Drizzle+SQLite es más simple de razonar y suficiente para el volumen de
  datos de una familia (cientos de transacciones al mes, no millones).
- **Backend propio (Node/Express + Postgres)**: da control total, pero implica
  mantener autenticación, políticas de acceso multiusuario y websockets de
  sincronización a mano — trabajo que Supabase ya resuelve out of the box para
  el tamaño de este producto.

## Seguridad y privacidad (SMS y datos financieros)

- El permiso de lectura de SMS se solicita de forma explícita y granular, y se
  puede desactivar por dispositivo (`devices.sms_reader_enabled`) — nunca es
  obligatorio para usar la app.
- El procesamiento de SMS ocurre **en el dispositivo**; solo el resultado
  parseado (monto, comercio, tipo) se sincroniza a Supabase, no el texto
  bancario completo con datos sensibles como saldos, salvo que el usuario lo
  confirme como transacción (en cuyo caso `raw_sms`/`raw_text` se guardan para
  auditar al parser, protegidos por las mismas políticas RLS de la familia).
- RLS en Postgres es la única vía de acceso a los datos — ni siquiera un bug
  en el cliente puede filtrar datos de otra familia, porque la base de datos
  misma lo impide.
