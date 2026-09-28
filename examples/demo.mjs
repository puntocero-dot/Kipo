// Demo ejecutable: node examples/demo.mjs
// Valida el parser contra los ejemplos del pedido original.

import { parseExpenseText } from '../src/parsing/expenseTextParser.mjs';

const chatExamples = [
  'Almuerzo con mi esposa en restaurante $35',
  'Gasolina carro $40',
  'Salida familiar al parque con niños $25 helados',
  'Cervezas con amigos $20',
];

console.log('=== Parser de lenguaje natural (chat) ===\n');
for (const text of chatExamples) {
  const result = parseExpenseText(text);
  console.log(`> "${text}"`);
  console.log(
    `  monto=${result.amount}  categoría=${result.category_group}/${result.category} (${result.category_label})  ` +
      `merchant=${result.merchant ?? '—'}  confianza=${result.confidence}`,
  );
  console.log(`  descripción="${result.description}"\n`);
}
