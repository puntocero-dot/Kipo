// Traduce entre `categories.kind` (Postgres, singular: 'fijo', 'necesario'…)
// y `groupSlug` (app/diccionario del parser, plural: 'fijos', 'necesarios'…)
// — ver database/generate-category-seed.mjs, que siembra `categories` con
// estos mismos `kind` a partir del diccionario compartido.
import { supabase } from '../lib/supabase';
import { GROUP_LABELS, type CategoryOption } from './categories';
import { colors, groupColors } from '../theme';

export const KIND_TO_GROUP: Record<string, string> = {
  fijo: 'fijos',
  necesario: 'necesarios',
  transporte: 'transporte',
  alimentacion_fuera: 'alimentacion_fuera',
  salidas_convivencia: 'salidas_convivencia',
  ingreso: 'ingresos',
};

export const GROUP_TO_KIND: Record<string, string> = Object.fromEntries(
  Object.entries(KIND_TO_GROUP).map(([kind, group]) => [group, kind]),
);

export interface CategoryMaps {
  idToSlug: Map<string, { groupSlug: string; subSlug: string }>;
  slugToId: Map<string, string>; // clave `${groupSlug}:${subSlug}`
  // Subcategorías agregadas por alguna familia (family_id no nulo) — las del
  // catálogo del sistema ya vienen de CATEGORY_OPTIONS, no se duplican aquí.
  customOptions: CategoryOption[];
}

export async function fetchCategoryMaps(familyId: string): Promise<CategoryMaps> {
  const idToSlug = new Map<string, { groupSlug: string; subSlug: string }>();
  const slugToId = new Map<string, string>();
  const customOptions: CategoryOption[] = [];

  // Antes traía la tabla entera (sistema + TODAS las familias) sin filtrar,
  // dependiendo 100% de RLS para acotarla — además de más lento (ver
  // idx_categories_family, migración 0021), un usuario con más de un
  // espacio de trabajo se traía las categorías personalizadas de CADA
  // familia a la que pertenece, no solo la activa. Filtrar por family_id
  // (o null = catálogo del sistema) corrige ambas cosas.
  const { data, error } = await supabase!
    .from('categories')
    .select('id, slug, kind, name, family_id')
    .or(`family_id.is.null,family_id.eq.${familyId}`);
  if (error) throw error;

  for (const row of data ?? []) {
    const groupSlug = KIND_TO_GROUP[row.kind] ?? row.kind;
    idToSlug.set(row.id, { groupSlug, subSlug: row.slug });
    slugToId.set(`${groupSlug}:${row.slug}`, row.id);
    if (row.family_id) {
      customOptions.push({
        groupSlug,
        groupLabel: GROUP_LABELS[groupSlug] ?? groupSlug,
        subSlug: row.slug,
        label: row.name,
        color: groupColors[groupSlug] ?? colors.muted,
        kind: row.kind === 'ingreso' ? 'ingreso' : 'gasto',
      });
    }
  }

  return { idToSlug, slugToId, customOptions };
}

export function categoryIdFor(maps: CategoryMaps, groupSlug: string | null, subSlug: string | null): string | null {
  if (!groupSlug || !subSlug) return null;
  return maps.slugToId.get(`${groupSlug}:${subSlug}`) ?? null;
}
