# Kipo

App para mantener el control de gastos como equipo familiar, y que debe crecer como cultura.

Registrar un gasto debe tomar menos de 5 segundos: se escribe en lenguaje natural
("Almuerzo con mi esposa en restaurante $35") o llega solo desde una alerta SMS
del banco, y Kipo lo categoriza automáticamente.

## Probar la app ya, con datos reales

```bash
cd mobile
npm install
npm run web
```

Abre Kipo en el navegador con datos de ejemplo ya cargados (dashboard,
captura por chat, bandeja de SMS simulada, presupuestos, recordatorios).
Todo lo que registres ahí queda guardado de verdad en tu dispositivo. Ver
[`mobile/README.md`](mobile/README.md) para el detalle de qué es real y qué
es simulado, y [`docs/TESTING_ENVIRONMENT.md`](docs/TESTING_ENVIRONMENT.md)
para el siguiente paso: un backend de staging compartido en Supabase.

## Diseño de la app

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura general, offline-first y sincronización familiar
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — modelo de datos (ver también [`database/schema.sql`](database/schema.sql))
- [`docs/NLP_PARSING.md`](docs/NLP_PARSING.md) — lógica de parsing de texto natural y SMS bancarios
- [`docs/SCREENS_FLOW.md`](docs/SCREENS_FLOW.md) — flujo de pantallas y wireframes del dashboard
- [`docs/TECH_STACK.md`](docs/TECH_STACK.md) — stack tecnológico recomendado y justificación
- [`docs/TESTING_ENVIRONMENT.md`](docs/TESTING_ENVIRONMENT.md) — cómo pasar de "corriendo en mi laptop" a un staging compartido por la familia, y de ahí a producción

## Probar el parser de forma aislada

El parser de captura (texto y SMS) tiene una implementación de referencia
ejecutable en `src/parsing/`, sin dependencias externas:

```bash
node examples/demo.mjs
```

La app en `mobile/` usa exactamente este mismo código (no una copia).
