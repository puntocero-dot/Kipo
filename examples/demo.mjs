// Demo ejecutable: node examples/demo.mjs
// Valida el parser contra los ejemplos del pedido original y contra SMS bancarios de muestra.

import { parseExpenseText } from '../src/parsing/expenseTextParser.mjs';
import { parseBankSms } from '../src/parsing/smsParser.mjs';

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

const smsExamples = [
  'Compra aprobada por $45.00 en RESTAURANTE EL SABOR el 02/09',
  'Su tarjeta terminada en 1234 fue debitada por $120.50 en SUPERMERCADO LA COLONIA',
  'Retiro de $100.00 en cajero ATM CENTRO',
  'BANCO XYZ: Compra por $12.30 en CAFE DEL PARQUE aprobada',
];

console.log('=== Parser de SMS bancarios ===\n');
for (const sms of smsExamples) {
  const result = parseBankSms(sms);
  console.log(`> "${sms}"`);
  console.log(
    `  monto=${result.amount}  merchant=${result.merchant ?? '—'}  tipo=${result.transaction_type}  ` +
      `patrón=${result.bank_pattern_id ?? 'fallback genérico'}  confianza=${result.confidence}\n`,
  );
}
