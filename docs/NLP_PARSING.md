# Kipo — Parsing de lenguaje natural y captura con IA

> La lectura de SMS bancarios que documentaba antes esta página se quitó por
> completo de la app (reemplazada por Kipobot, ver §2 más abajo) — el
> permiso de Android, la pantalla, las tablas asociadas y el parser de
> referencia (`src/parsing/smsParser.mjs`) ya no existen en el repo.

Implementación de referencia (ejecutable, sin dependencias):

- [`src/parsing/categoryDictionary.mjs`](../src/parsing/categoryDictionary.mjs) — diccionario de categorías/palabras clave
- [`src/parsing/expenseTextParser.mjs`](../src/parsing/expenseTextParser.mjs) — parser de texto/voz (respaldo local, sin red)
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

### Aprendizaje por corrección

Cuando el usuario cambia la categoría sugerida, la app inserta una fila en
`categorization_rules` con la palabra distintiva del mensaje (ej. el nombre
de un restaurante frecuente) apuntando a la categoría elegida, con
`family_id` de esa familia. La próxima vez, esa regla se evalúa **antes** que
el diccionario del sistema.

## 2. Kipobot — captura conversacional con IA (`api/parse-expense.js`)

Reemplaza la lectura de SMS bancarios (quitada por completo: sin permiso de
Android, sin pantalla, sin tabla `sms_inbox`). En vez de leer una alerta del
banco, la persona le cuenta el gasto a Kipobot en `mobile/app/(tabs)/chat.tsx`
tal como lo diría en voz alta, y un modelo de IA lo interpreta.

### Por qué IA y no solo el parser de reglas

El parser de `expenseTextParser.mjs` (§1) sigue existiendo y es instantáneo,
gratis y offline — pero es rígido: solo reconoce los patrones que ya
conocemos. Un modelo de lenguaje entiende variaciones naturales que el
diccionario no cubre, y — la diferencia real frente a antes — puede
**preguntar lo que falte** ("¿fue en efectivo o con tarjeta?", "¿cuánto
fue?") en vez de adivinar o dejar la transacción a medias.

### Arquitectura

`mobile/src/lib/aiExpense.ts` llama a `POST /api/parse-expense` (función
serverless en Vercel, mismo proyecto que la landing — ver `vercel.json`).
Nunca se llama a la API de Gemini directo desde la app: la key vive solo en
la variable de entorno `GEMINI_API_KEY` de Vercel — si viviera en el
cliente, cualquiera que descompile el APK podría extraerla y gastarla a
nuestro nombre.

El endpoint usa `gemini-3.5-flash-lite` (el más barato entre los comparados
— Gemini/DeepSeek/Grok/Kimi — a fracciones de centavo por gasto; se migró
desde `gemini-2.5-flash-lite` cuando Google lo descontinuó para cuentas
nuevas) con salida estructurada (`responseSchema`): el modelo elige la categoría de una lista
cerrada que la app le manda en cada request (nunca inventa un `groupSlug`
que no exista), y responde con `status: "ready"` (trae un draft completo) o
`status: "needs_clarification"` (trae una sola pregunta corta).

### Conversación multi-turno

Mientras Kipobot está a medio interpretar un gasto (te hizo una pregunta),
`chat.tsx` acumula esos turnos y se los reenvía en el siguiente mensaje, para
que el modelo tenga el contexto completo. Apenas el draft queda `ready` (o
falla y cae al respaldo local), ese contexto se vacía — el siguiente mensaje
empieza una interpretación nueva, no arrastra el gasto anterior.

### Respaldo sin red (nunca deja a alguien sin poder registrar un gasto)

Si `/api/parse-expense` no responde (sin conexión, `GEMINI_API_KEY` sin
configurar, error de Gemini, timeout de 12s), `chat.tsx` cae automáticamente
al parser local por reglas (§1) con el texto completo de la conversación
hasta ese punto, y avisa en el chat que usó "modo rápido" para que la
persona sepa que vale la pena revisar la categoría.

### Nunca se conecta a APIs bancarias ni mueve dinero real

Todo el procesamiento es sobre el texto que la propia persona escribe en el
chat. No hay scraping, no hay credenciales bancarias, no hay Open Banking —
por diseño, para minimizar superficie de riesgo y cumplimiento.
