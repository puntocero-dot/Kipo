// Parser de lenguaje natural para registrar gastos con mínima fricción.
// Determinista y 100% offline (sin llamadas a red): reglas + diccionario de
// palabras clave. Si no logra una categoría con confianza suficiente, devuelve
// category: null y confidence: 'low' para que la UI pida confirmación en vez
// de adivinar en silencio.
//
// El fallback a un LLM (Claude) para casos ambiguos vive en `llmFallback.mjs`
// y solo se invoca cuando confidence === 'low' y hay conexión — ver docs/NLP_PARSING.md.

import { flattenKeywords } from './categoryDictionary.mjs';

const KEYWORDS = flattenKeywords();

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado'];

function stripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Extrae el monto. Prioriza números precedidos de "$" (el caso de todos los
 * ejemplos del usuario); si no hay ninguno, busca un número seguido de una
 * palabra de moneda ("40 quetzales", "20 pesos").
 */
export function extractAmount(text) {
  const dollarMatch = text.match(/\$\s?(\d+(?:[.,]\d{1,2})?)/);
  if (dollarMatch) {
    return { amount: parseFloat(dollarMatch[1].replace(',', '.')), matchedText: dollarMatch[0] };
  }
  const currencyWordMatch = text.match(/(\d+(?:[.,]\d{1,2})?)\s?(dolares|dólares|usd|quetzales|gtq|pesos|mxn|lempiras|hnl|soles|colones)/i);
  if (currencyWordMatch) {
    return { amount: parseFloat(currencyWordMatch[1].replace(',', '.')), matchedText: currencyWordMatch[0] };
  }
  return { amount: null, matchedText: null };
}

/**
 * Extrae una fecha relativa mencionada en el texto. Por defecto usa `now`
 * (la app está pensada para registrar el gasto en el momento en que ocurre).
 */
export function extractDate(text, now = new Date()) {
  const normalized = stripAccents(text.toLowerCase());
  if (/\bhoy\b/.test(normalized)) return new Date(now);
  if (/\banteayer\b/.test(normalized)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return d;
  }
  if (/\bayer\b/.test(normalized)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  const explicit = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (explicit) {
    const [, day, month, year] = explicit;
    const fullYear = year ? (year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10)) : now.getFullYear();
    return new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
  }
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const weekday = WEEKDAYS[i];
    if (normalized.includes(weekday)) {
      const targetDow = i === 4 ? 3 : i; // normaliza 'miércoles' duplicado al índice 3
      const d = new Date(now);
      const diff = (d.getDay() - targetDow + 7) % 7 || 7; // el más reciente en el pasado
      d.setDate(d.getDate() - diff);
      return d;
    }
  }
  return new Date(now);
}

/**
 * Busca la primera palabra clave (ya ordenadas por longitud/prioridad) que
 * aparezca en el texto y devuelve la categoría asociada.
 */
export function detectCategory(text) {
  const normalized = stripAccents(text.toLowerCase());
  for (const entry of KEYWORDS) {
    const needle = stripAccents(entry.keyword.toLowerCase());
    if (normalized.includes(needle)) {
      return {
        group: entry.groupSlug,
        groupLabel: entry.groupLabel,
        subcategory: entry.subSlug,
        subcategoryLabel: entry.subLabel,
        matchedKeyword: entry.keyword,
      };
    }
  }
  return null;
}

/**
 * Intenta adivinar un "merchant" (comercio/lugar) legible a partir de la
 * preposición "en" ("en restaurante", "en Walmart"). Es un mejor esfuerzo:
 * si no encuentra nada razonable, deja merchant en null y la UI usa la
 * descripción completa.
 */
export function extractMerchant(textWithoutAmount) {
  const match = textWithoutAmount.match(/\ben\s+([a-záéíóúñ0-9][\w\sáéíóúñ]{1,30}?)(?:$|[.,]|\s+(?:con|el|por))/i);
  if (!match) return null;
  const merchant = match[1].trim();
  return merchant.length > 0 ? merchant.charAt(0).toUpperCase() + merchant.slice(1) : null;
}

/**
 * Punto de entrada principal. Convierte un mensaje de texto libre en una
 * transacción sugerida, lista para mostrarse editable en la UI de chat.
 */
export function parseExpenseText(rawText, { now = new Date() } = {}) {
  const text = rawText.trim();
  const { amount, matchedText } = extractAmount(text);
  const textWithoutAmount = matchedText ? text.replace(matchedText, '').trim() : text;
  const category = detectCategory(text);
  const date = extractDate(text, now);
  const merchant = extractMerchant(textWithoutAmount);

  const description = textWithoutAmount.replace(/\s{2,}/g, ' ').trim();

  return {
    raw_text: rawText,
    amount,
    currency: null, // resuelto por la app según el perfil de la familia; ver docs/NLP_PARSING.md
    merchant,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    occurred_at: date.toISOString(),
    category_group: category?.group ?? null,
    category: category?.subcategory ?? null,
    category_label: category?.subcategoryLabel ?? null,
    confidence: amount !== null && category !== null ? 'high' : amount !== null ? 'medium' : 'low',
    needs_review: amount === null || category === null,
  };
}
