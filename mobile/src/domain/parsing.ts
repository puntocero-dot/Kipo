// Envuelve el parser compartido (../../src/parsing) agregando las reglas de
// categorización aprendidas de esta familia (categorization_rules en el
// esquema), que deben evaluarse ANTES que el diccionario del sistema — ver
// docs/NLP_PARSING.md § Aprendizaje por corrección.
import { parseExpenseText } from '@parsing/expenseTextParser.mjs';
import { parseBankSms as parseBankSmsRaw } from '@parsing/smsParser.mjs';
import { findCategory } from './categories';
import type { CategorizationRule } from './types';

// Algunos patrones de smsParser.mjs/expenseTextParser.mjs combinan
// comodines perezosos (`[\s\S]*?`) que, sobre texto largo y adversarial que
// nunca matchea, pueden degradar a backtracking cuadrático — un límite
// generoso (nadie escribe/pega un gasto o SMS bancario real de más de 4000
// caracteres) evita que eso se vuelva un problema de rendimiento real sin
// tener que reescribir esas regex.
const MAX_INPUT_LENGTH = 4000;
function capInput(text: string): string {
  return text.length > MAX_INPUT_LENGTH ? text.slice(0, MAX_INPUT_LENGTH) : text;
}

export interface ParsedDraft {
  type: 'gasto' | 'ingreso';
  amount: number | null;
  merchant: string | null;
  description: string;
  occurredAt: string;
  groupSlug: string | null;
  subSlug: string | null;
  categoryLabel: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  needsReview: boolean;
  rawText: string;
}

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findFamilyRule(text: string, rules: CategorizationRule[]): CategorizationRule | null {
  const normalized = stripAccents(text.toLowerCase());
  return rules.find((r) => normalized.includes(stripAccents(r.keyword.toLowerCase()))) ?? null;
}

export function parseExpenseWithFamilyRules(
  text: string,
  rules: CategorizationRule[],
  now: Date = new Date(),
): ParsedDraft {
  const capped = capInput(text);
  const base = parseExpenseText(capped, { now });
  const isIncome = base.type === 'ingreso';
  // Las reglas de categorización de la familia son de gasto (nacen de
  // corregir la categoría de un gasto — ver correctCategory) y no aplican a
  // un ingreso, que no tiene categoría.
  const rule = isIncome ? null : findFamilyRule(capped, rules);

  const groupSlug = rule?.groupSlug ?? base.category_group;
  const subSlug = rule?.subSlug ?? base.category;
  const category = findCategory(groupSlug, subSlug);

  return {
    type: base.type as ParsedDraft['type'],
    amount: base.amount,
    merchant: base.merchant,
    description: base.description,
    occurredAt: base.occurred_at,
    groupSlug,
    subSlug,
    categoryLabel: category?.label ?? null,
    confidence: rule ? (base.amount !== null ? 'high' : 'medium') : (base.confidence as ParsedDraft['confidence']),
    needsReview: isIncome ? base.amount === null : base.amount === null || groupSlug === null,
    rawText: capped,
  };
}

export function parseBankSms(rawSms: string, options?: Parameters<typeof parseBankSmsRaw>[1]) {
  return parseBankSmsRaw(capInput(rawSms), options);
}
