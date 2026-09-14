# Kipo — Arquitectura

Kipo es una app de finanzas familiares diseñada alrededor de un principio: **registrar
un gasto debe tomar menos de 5 segundos**. Todo lo demás (categorización, presupuestos,
recordatorios) existe para sostener ese momento de captura sin fricción.

## Vista de alto nivel

```mermaid
flowchart TB
    subgraph Cliente["App móvil (React Native / Expo)"]
        UI[UI: Dashboard, Chat de captura, Historial]
        Parser[Parser NLP local\nsrc/parsing/expenseTextParser.mjs]
        SMSListener[Listener SMS\n(solo Android)]
        LocalDB[(SQLite local\nDrizzle ORM)]
        SyncQueue[Cola de sincronización]
    end

    subgraph Backend["Supabase (Postgres + Auth + Realtime + Edge Functions)"]
        PG[(Postgres\nver database/schema.sql)]
        Realtime[Canal Realtime por family_id]
        EdgeFns[Edge Functions:\n- parse-fallback (LLM)\n- check-budgets\n- send-reminders]
        Auth[Auth + RLS por familia]
    end

    Push[Push notifications\nExpo Push]

    UI -->|texto/voz| Parser --> LocalDB
    SMSListener --> Parser
    LocalDB --> SyncQueue -->|cuando hay red| PG
    PG --> Realtime -->|cambios de otros miembros| SyncQueue --> LocalDB
    Parser -.baja confianza + online.-> EdgeFns
    EdgeFns --> PG
    EdgeFns --> Push
```

## Principios de diseño

1. **Offline-first de verdad.** Registrar un gasto nunca depende de la red: se
   escribe primero en SQLite local y la UI responde de inmediato. La sincronización
   hacia Postgres ocurre en segundo plano.
2. **El parser rápido y gratis va primero.** Reglas/regex/diccionario local
   resuelven la gran mayoría de los casos (ver `docs/NLP_PARSING.md`). Un LLM
   solo se invoca como *fallback* cuando la confianza es baja y hay conexión,
   para mantener costo y latencia bajos.
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
| Captura | Chat de texto, dictado por voz, listener de SMS | `UI` + `SMSListener` |
| Parsing | Extraer monto/fecha/categoría/comercio de texto libre o SMS | `src/parsing/*.mjs` |
| Persistencia local | Escritura instantánea, fuente de verdad offline | SQLite + Drizzle |
| Sincronización | Cola de cambios locales → Postgres, y viceversa vía Realtime | `SyncQueue` |
| Backend | Multiusuario, RLS, presupuestos, recordatorios programados | Supabase (Postgres + Edge Functions) |
| Notificaciones | Recordatorios de pago y alertas de presupuesto | Expo Push + Edge Function `check-budgets` |

Ver también: `docs/DATABASE_SCHEMA.md`, `docs/NLP_PARSING.md`, `docs/SCREENS_FLOW.md`,
`docs/TECH_STACK.md`.
