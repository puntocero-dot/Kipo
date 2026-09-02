// Envuelve el parser compartido (../../src/parsing) agregando las reglas de
// categorización aprendidas de esta familia (categorization_rules en el
// esquema), que deben evaluarse ANTES que el diccionario del sistema — ver
// docs/NLP_PARSING.md § Aprendizaje por corrección.
import { parseExpenseText } from '@parsing/expenseTextParser.mjs';
import { parseBankSms } from '@parsing/smsParser.mjs';
import { findCategory } from './categories';
import type { CategorizationRule } from './types';

export interface ParsedDraft {
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
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
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
  const base = parseExpenseText(text, { now });
  const rule = findFamilyRule(text, rules);

  const groupSlug = rule?.groupSlug ?? base.category_group;
  const subSlug = rule?.subSlug ?? base.category;
  const category = findCategory(groupSlug, subSlug);

  return {
    amount: base.amount,
    merchant: base.merchant,
    description: base.description,
    occurredAt: base.occurred_at,
    groupSlug,
    subSlug,
    categoryLabel: category?.label ?? null,
    confidence: rule ? (base.amount !== null ? 'high' : 'medium') : (base.confidence as ParsedDraft['confidence']),
    needsReview: base.amount === null || groupSlug === null,
    rawText: text,
  };
}

export { parseBankSms };
