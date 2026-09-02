# Kipo — Parsing de lenguaje natural y SMS

Implementación de referencia (ejecutable, sin dependencias):

- [`src/parsing/categoryDictionary.mjs`](../src/parsing/categoryDictionary.mjs) — diccionario de categorías/palabras clave
- [`src/parsing/expenseTextParser.mjs`](../src/parsing/expenseTextParser.mjs) — parser de texto/voz
- [`src/parsing/smsParser.mjs`](../src/parsing/smsParser.mjs) — parser de SMS bancarios
- [`examples/demo.mjs`](../examples/demo.mjs) — demo ejecutable: `node examples/demo.mjs`

## 1. Parser de texto natural (chat / dictado por voz)

### Estrategia: reglas primero, LLM como fallback

El 90%+ de los mensajes de captura son cortos y siguen patrones predecibles
("`<actividad>` `<contexto social opcional>` `$monto`"). Resolverlos con
regex + diccionario es instantáneo, gratis y funciona 100% offline. Un LLM
(Claude Haiku) solo entra como *fallback* cuando la confianza es baja **y**
hay conexión — evita depender de red para la acción más frecuente de la app.

### Pipeline (`parseExpenseText`)

1. **Monto** (`extractAmount`): prioriza números precedidos de `$` (todos los
   ejemplos del pedido usan este formato); si no hay, busca un número seguido
   de una palabra de moneda ("40 quetzales").
2. **Fecha** (`extractDate`): por defecto "ahora" (se captura en el momento).
   Reconoce "hoy", "ayer", "anteayer", nombres de día de la semana (toma la
   ocurrencia más reciente en el pasado) y fechas explícitas `dd/mm[/aaaa]`.
3. **Categoría** (`detectCategory`): recorre el diccionario aplanado y
   ordenado por **prioridad de grupo primero, longitud de palabra clave
   después**. Esto es la decisión de diseño clave: el contexto social
   ("esposa", "hijos", "amigos") tiene prioridad 1 y le gana a una palabra de
   comercio genérica como "restaurante" (prioridad 3) — así "almuerzo con mi
   esposa en restaurante" cae en **En Pareja**, no en "Alimentación fuera",
   tal como lo definió el usuario en su esquema de categorías.
4. **Comercio** (`extractMerchant`): mejor esfuerzo, busca `en <lugar>`. Si no
   encuentra nada razonable, queda `null` y la UI muestra la descripción
   completa en su lugar (nunca se inventa un nombre de comercio).
5. **Confianza**: `high` si hay monto + categoría, `medium` si solo hay monto,
   `low` si falta el monto. Con `low`/`medium` la transacción se marca
   `needs_review: true` y, si hay conexión, se puede invocar el fallback LLM.

### Resultado sobre los 4 ejemplos del pedido

```
"Almuerzo con mi esposa en restaurante $35"
  → $35, En Pareja, merchant="Restaurante", confianza=high

"Gasolina carro $40"
  → $40, Transporte/Gasolina, confianza=high

"Salida familiar al parque con niños $25 helados"
  → $25, En Familia, confianza=high

"Cervezas con amigos $20"
  → $20, Personales/Amigos, confianza=high
```

(Verificado ejecutando `node examples/demo.mjs`.)

### Fallback LLM (casos ambiguos, ej. "Compras varias $60")

Cuando `confidence !== 'high'` y hay red, se envía un prompt estructurado a
Claude (vía una Edge Function de Supabase, nunca desde el cliente para no
exponer la API key) pidiendo **solo JSON**:

```
Eres un clasificador de gastos personales para una app familiar. Dado un
mensaje de texto libre, extrae los campos y responde ÚNICAMENTE con JSON
válido, sin explicación:

{
  "amount": number | null,
  "merchant": string | null,
  "category_kind": "fijo" | "necesario" | "transporte" | "alimentacion_fuera" | "salidas_convivencia" | null,
  "category_subslug": string | null,
  "social_context": "familia" | "pareja" | "amigos" | null
}

Reglas:
- Si el mensaje menciona a la pareja/esposa/esposo, cónyuge o una cita, el
  contexto social es "pareja" y la categoría es "salidas_convivencia".
- Si menciona hijos/niños/familia, el contexto es "familia".
- Si menciona amigos, el contexto es "amigos".
- Si no hay contexto social explícito, clasifica por el tipo de gasto
  (comida, transporte, etc.) usando las categorías de Kipo.
- No inventes un monto si no aparece un número en el texto.

Mensaje: "{texto_del_usuario}"
```

La respuesta se valida contra un JSON Schema antes de aplicarse; si no
califica, la transacción simplemente queda `pendiente` para que el usuario la
categorice a mano (nunca se bloquea la captura por un fallo del LLM).

### Aprendizaje por corrección

Cuando el usuario cambia la categoría sugerida, la app inserta una fila en
`categorization_rules` con la palabra distintiva del mensaje (ej. el nombre
de un restaurante frecuente) apuntando a la categoría elegida, con
`family_id` de esa familia. La próxima vez, esa regla se evalúa **antes** que
el diccionario del sistema.

## 2. Parser de SMS bancarios (`parseBankSms`)

### Limitación de plataforma (importante)

- **Android**: permite leer SMS en segundo plano con permisos en tiempo de
  ejecución `READ_SMS` / `RECEIVE_SMS` y un listener nativo (módulo nativo o
  librería tipo `react-native-android-sms-listener`). Kipo lo implementa así.
- **iOS**: Apple **no permite** que apps de terceros lean SMS en segundo
  plano — no existe una API pública para esto. La alternativa de baja
  fricción es una **Share Extension**: el usuario, al recibir la notificación
  bancaria, la comparte manualmente hacia Kipo (2 toques) y se procesa con el
  mismo `parseBankSms`. Esto se debe comunicar claramente en el onboarding de
  iOS para no prometer una función que la plataforma no permite.

### Estrategia: patrones por banco + fallback genérico

Los formatos de SMS varían por banco y país, así que `BANK_PATTERNS` es una
lista extensible de reglas (regex con grupos nombrados) — se agregan nuevas
sin tocar la lógica central. Incluye 3 patrones de ejemplo (compra aprobada,
tarjeta debitada, retiro en cajero) que cubren los formatos más comunes en
banca latinoamericana. Si ningún patrón calza, un **fallback genérico**
extrae el monto y la primera secuencia en mayúsculas como posible comercio,
marcado con `confidence: 'low'` para que el usuario lo confirme o corrija
manualmente — y esa corrección puede promoverse a un nuevo patrón.

### Deduplicación

`matchExistingTransaction` evita sugerir un SMS que corresponde a un gasto
que el usuario ya registró por chat/voz: si existe una transacción con el
mismo monto dentro de una ventana de ±2 horas, el SMS se vincula a esa
transacción (`sms_inbox.matched_transaction_id`) en vez de crear una
sugerencia duplicada.

### Nunca se conecta a APIs bancarias

Todo el procesamiento es sobre el **texto de la notificación** que el propio
sistema operativo ya entregó a la app (con permiso explícito del usuario). No
hay scraping, no hay credenciales bancarias, no hay Open Banking — por diseño,
para minimizar superficie de riesgo y cumplimiento.
