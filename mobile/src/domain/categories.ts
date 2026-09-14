// Puente entre el diccionario de categorías compartido (usado también por el
// parser en ../../src/parsing) y la UI de la app. Una sola fuente de verdad
// para las categorías: src/parsing/categoryDictionary.mjs.
import { CATEGORY_GROUPS } from '@parsing/categoryDictionary.mjs';
import { colors, groupColors } from '../theme';

export interface CategoryOption {
  groupSlug: string;
  groupLabel: string;
  subSlug: string;
  label: string;
  color: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = Object.entries(CATEGORY_GROUPS).flatMap(
  ([groupSlug, group]: [string, any]) =>
    Object.entries(group.subcategories).map(([subSlug, sub]: [string, any]) => ({
      groupSlug,
      groupLabel: group.label as string,
      subSlug,
      label: sub.label as string,
      color: groupColors[groupSlug] ?? colors.muted,
    })),
);

export const GROUP_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_GROUPS).map(([slug, group]: [string, any]) => [slug, group.label]),
);

// Orden fijo de grupos para leyendas/gráficos — nunca se cicla.
export const GROUP_ORDER = Object.keys(CATEGORY_GROUPS);

export function findCategory(groupSlug: string | null, subSlug: string | null): CategoryOption | null {
  if (!groupSlug || !subSlug) return null;
  return CATEGORY_OPTIONS.find((c) => c.groupSlug === groupSlug && c.subSlug === subSlug) ?? null;
}

export function categoryColor(groupSlug: string | null): string {
  if (!groupSlug) return colors.muted;
  return groupColors[groupSlug] ?? colors.muted;
}
