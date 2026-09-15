// Parser de alertas SMS bancarias.
//
// IMPORTANTE (limitación de plataforma): la lectura de SMS en segundo plano
// solo es posible en Android (permisos READ_SMS / RECEIVE_SMS + un listener
// nativo, p. ej. un módulo nativo o `react-native-android-sms-listener`).
// iOS NO permite a apps de terceros leer SMS en segundo plano. En iOS el
// equivalente de baja fricción es una Share Extension / Shortcut: el usuario
// comparte manualmente la notificación bancaria hacia Kipo y se procesa con
// el mismo parser. Ver docs/NLP_PARSING.md.
//
// Los formatos de SMS bancarios varían por banco y país, así que este módulo
// se diseñó para crecer: `BANK_PATTERNS` es una lista de reglas que se pueden
// ampliar sin tocar la lógica central, agregando el patrón real que envíe
// cada banco del usuario.

import { extractAmount } from './expenseTextParser.mjs';

const BANK_PATTERNS = [
  {
    id: 'abono_generico',
    // "*Davivienda Abono*\nCta:814\nCta.O.:******\nConcep:2Q PAGA VACACION SEP\n
    //  Fec:14/09/26 16:05:06\nMonto:$1060.79\n-Si NO la reconoce llamar al..."
    // — un depósito/abono, no un cargo: sin este patrón caía en el fallback
    // genérico, que asume "compra" (gasto) para cualquier SMS que no matchee
    // nada, así que un depósito real se registraba como un gasto.
    regex: /abono[\s\S]*?concep\s*:?\s*([^\n]+)[\s\S]*?monto\s*:?\s*\$?\s*([\d.,]+)/i,
    map: (m) => ({ amount: parseFloat(m[2].replace(',', '.')), merchant: m[1].trim(), type: 'deposito' }),
  },
  {
    id: 'compra_aprobada_generico',
    // "Compra aprobada por $45.00 en RESTAURANTE EL SABOR el 02/09"
    regex: /compra\s+(?:aprobada\s+)?por\s+\$?\s*([\d.,]+)\s+en\s+([A-Z0-9ÁÉÍÓÚÑ.\s]+?)(?:\s+el\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?))?(?:\s+aprobada)?\.?$/i,
    map: (m) => ({ amount: parseFloat(m[1].replace(',', '.')), merchant: m[2].trim(), dateText: m[3] ?? null, type: 'compra' }),
  },
  {
    id: 'tarjeta_debitada_generico',
    // "Su tarjeta terminada en 1234 fue debitada por $120.50 en SUPERMERCADO LA COLONIA"
    regex: /tarjeta\s+(?:terminada en|termina en)\s*(\d{4}).*?(?:debitada|cargo)\s+por\s+\$?\s*([\d.,]+)\s+en\s+([A-Z0-9ÁÉÍÓÚÑ.\s]+)/i,
    map: (m) => ({ amount: parseFloat(m[2].replace(',', '.')), merchant: m[3].trim(), cardLast4: m[1], type: 'compra' }),
  },
  {
    id: 'retiro_cajero',
    // "Retiro de $100.00 en cajero ATM CENTRO"
    regex: /retiro\s+(?:de\s+)?\$?\s*([\d.,]+)\s+(?:en|desde)\s+(cajero|atm)\s*([A-Z0-9ÁÉÍÓÚÑ.\s]*)/i,
    map: (m) => ({ amount: parseFloat(m[1].replace(',', '.')), merchant: (m[3] || m[2]).trim() || 'Cajero ATM', type: 'retiro' }),
  },
];

/**
 * Intenta parsear con las reglas conocidas primero; si ninguna calza, cae a
 * una extracción genérica (monto + primera secuencia en mayúsculas como
 * posible comercio) y marca baja confianza para revisión manual.
 */
export function parseBankSms(rawSms, { now = new Date() } = {}) {
  for (const pattern of BANK_PATTERNS) {
    const match = rawSms.match(pattern.regex);
    if (match) {
      const parsed = pattern.map(match);
      return {
        raw_sms: rawSms,
        bank_pattern_id: pattern.id,
        amount: parsed.amount,
        merchant: normalizeMerchant(parsed.merchant),
        card_last4: parsed.cardLast4 ?? null,
        transaction_type: parsed.type,
        occurred_at: now.toISOString(),
        confidence: 'high',
      };
    }
  }

  // Fallback genérico: solo monto + posible comercio en mayúsculas.
  const { amount } = extractAmount(rawSms);
  const upperWordsMatch = rawSms.match(/\b([A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ0-9]{2,}){0,4})\b/);
  return {
    raw_sms: rawSms,
    bank_pattern_id: null,
    amount,
    merchant: upperWordsMatch ? normalizeMerchant(upperWordsMatch[1]) : null,
    card_last4: null,
    transaction_type: /retiro/i.test(rawSms) ? 'retiro' : /abono|dep[oó]sito/i.test(rawSms) ? 'deposito' : 'compra',
    occurred_at: now.toISOString(),
    confidence: amount !== null ? 'low' : 'none',
  };
}

function normalizeMerchant(merchant) {
  return merchant
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Evita duplicados: si el usuario ya registró manualmente (chat/voz) un gasto
 * por el mismo monto dentro de una ventana de tiempo, se vincula el SMS a esa
 * transacción existente en vez de crear una sugerencia nueva.
 */
export function matchExistingTransaction(smsResult, recentTransactions, { windowMinutes = 120 } = {}) {
  const smsTime = new Date(smsResult.occurred_at).getTime();
  return (
    recentTransactions.find((t) => {
      const sameAmount = Math.abs(t.amount - smsResult.amount) < 0.01;
      const withinWindow = Math.abs(new Date(t.occurred_at).getTime() - smsTime) <= windowMinutes * 60 * 1000;
      return sameAmount && withinWindow && t.source !== 'sms';
    }) ?? null
  );
}
