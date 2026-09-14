// Traduce entre `categories.kind` (Postgres, singular: 'fijo', 'necesario'…)
// y `groupSlug` (app/diccionario del parser, plural: 'fijos', 'necesarios'…)
// — ver database/generate-category-seed.mjs, que siembra `categories` con
// estos mismos `kind` a partir del diccionario compartido.
import { supabase } from '../lib/supabase';

export const KIND_TO_GROUP: Record<string, string> = {
  fijo: 'fijos',
  necesario: 'necesarios',
  transporte: 'transporte',
  alimentacion_fuera: 'alimentacion_fuera',
  salidas_convivencia: 'salidas_convivencia',
};

export const GROUP_TO_KIND: Record<string, string> = Object.fromEntries(
  Object.entries(KIND_TO_GROUP).map(([kind, group]) => [group, kind]),
);

export interface CategoryMaps {
  idToSlug: Map<string, { groupSlug: string; subSlug: string }>;
  slugToId: Map<string, string>; // clave `${groupSlug}:${subSlug}`
}

export async function fetchCategoryMaps(): Promise<CategoryMaps> {
  const idToSlug = new Map<string, { groupSlug: string; subSlug: string }>();
  const slugToId = new Map<string, string>();

  const { data, error } = await supabase!.from('categories').select('id, slug, kind');
  if (error) throw error;

  for (const row of data ?? []) {
    const groupSlug = KIND_TO_GROUP[row.kind] ?? row.kind;
    idToSlug.set(row.id, { groupSlug, subSlug: row.slug });
    slugToId.set(`${groupSlug}:${row.slug}`, row.id);
  }

  return { idToSlug, slugToId };
}

export function categoryIdFor(maps: CategoryMaps, groupSlug: string | null, subSlug: string | null): string | null {
  if (!groupSlug || !subSlug) return null;
  return maps.slugToId.get(`${groupSlug}:${subSlug}`) ?? null;
}
