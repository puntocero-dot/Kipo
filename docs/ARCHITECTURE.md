# Kipo — Arquitectura

Kipo es una app de finanzas familiares diseñada alrededor de un principio: **registrar
un gasto debe tomar menos de 5 segundos**. Todo lo demás (categorización, presupuestos,
recordatorios) existe para sostener ese momento de captura sin fricción.

## Vista de alto nivel

```mermaid
flowchart TB
    subgraph Cliente["App móvil (React Native / Expo)"]
        UI[UI: Dashboard, Chat de captura con Kipobot, Historial]
        Parser[Parser NLP local\nsrc/parsing/expenseTextParser.mjs]
        LocalDB[(SQLite local\nDrizzle ORM)]
        SyncQueue[Cola de sincronización]
    end

    subgraph Backend["Supabase (Postgres + Auth + Realtime + Edge Functions)"]
        PG[(Postgres\nver database/schema.sql)]
        Realtime[Canal Realtime por family_id]
        EdgeFns[Edge Functions:\n- check-budgets\n- send-reminders]
    Kipobot[api/parse-expense.js\n(Vercel, Gemini)]
        Auth[Auth + RLS por familia]
    end

    Push[Push notifications\nExpo Push]

    UI -->|texto/voz| Kipobot -.sin red o sin respuesta.-> Parser --> LocalDB
    LocalDB --> SyncQueue -->|cuando hay red| PG
    PG --> Realtime -->|cambios de otros miembros| SyncQueue --> LocalDB
    Kipobot --> LocalDB
    EdgeFns --> PG
    EdgeFns --> Push
```

## Principios de diseño

1. **Offline-first de verdad.** Registrar un gasto nunca depende de la red: se
   escribe primero en SQLite local y la UI responde de inmediato. La sincronización
   hacia Postgres ocurre en segundo plano.
2. **Kipobot (IA) es la ruta principal de captura; el parser local es el
   respaldo.** A diferencia del diseño original (reglas primero, LLM como
   fallback por costo), hoy Kipobot interpreta el gasto y pregunta lo que
   falte — el parser de reglas local (`docs/NLP_PARSING.md` §1) solo entra si
   no hay red o el servicio de IA falla, para que la captura nunca se bloquee.
3. **Nunca adivinar en silencio.** Si el parser no está seguro (monto o categoría
   faltante), la transacción queda en estado `pendiente` con la categoría más
   probable pre-seleccionada, pero visible para confirmar/corregir en un toque.
4. **Sincronización familiar por Realtime, no por polling.** Cada familia tiene
   un `family_id`; Supabase Realtime empuja los cambios de un miembro al resto
   en segundos, y RLS (Row Level Security) garantiza que una familia nunca vea
   datos de otra.
5. **Corrección = aprendizaje.** Cuando un usuario corrige la categoría sugerida,
   se guarda como una fila nueva en `categorization_rules` (scoped a esa familia),
   así el parser mejora con el uso sin tocar código.

## Capas

| Capa | Responsabilidad | Dónde vive |
|---|---|---|
| Captura | Chat de texto, dictado por voz | `UI` |
| Interpretación | Kipobot (IA, Gemini) como ruta principal; parser de reglas local como respaldo sin red | `api/parse-expense.js` + `src/parsing/*.mjs` |
| Persistencia local | Escritura instantánea, fuente de verdad offline | SQLite + Drizzle |
| Sincronización | Cola de cambios locales → Postgres, y viceversa vía Realtime | `SyncQueue` |
| Backend | Multiusuario, RLS, presupuestos, recordatorios programados | Supabase (Postgres + Edge Functions) |
| Notificaciones | Recordatorios de pago y alertas de presupuesto | Expo Push + Edge Function `check-budgets` |

Ver también: `docs/DATABASE_SCHEMA.md`, `docs/NLP_PARSING.md`, `docs/SCREENS_FLOW.md`,
`docs/TECH_STACK.md`.
