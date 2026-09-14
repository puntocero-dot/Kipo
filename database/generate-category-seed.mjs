// Genera database/categorySeed.sql a partir de src/parsing/categoryDictionary.mjs
// — una sola fuente de verdad para las categorías, en vez de mantener el SQL
// y el diccionario del parser sincronizados a mano.
// Uso: node database/generate-category-seed.mjs > database/categorySeed.sql
import { CATEGORY_GROUPS } from '../src/parsing/categoryDictionary.mjs';

// groupSlug del diccionario (plural, ej. "fijos") -> categories.kind en el
// esquema (singular, ver database/schema.sql).
const KIND_MAP = {
  fijos: 'fijo',
  necesarios: 'necesario',
  transporte: 'transporte',
  alimentacion_fuera: 'alimentacion_fuera',
  salidas_convivencia: 'salidas_convivencia',
  ingresos: 'ingreso',
};

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

const lines = [];
lines.push('-- GENERADO por database/generate-category-seed.mjs — no editar a mano.');
lines.push('-- Vuelve a correr el script si cambias src/parsing/categoryDictionary.mjs.');
lines.push('');
lines.push('insert into categories (family_id, parent_id, slug, name, kind, is_system, sort_order)');
lines.push('values');

const rows = [];
let sortOrder = 0;
for (const [groupSlug, group] of Object.entries(CATEGORY_GROUPS)) {
  const kind = KIND_MAP[groupSlug];
  for (const [subSlug, sub] of Object.entries(group.subcategories)) {
    rows.push(
      `  (null, null, ${sqlString(subSlug)}, ${sqlString(sub.label)}, ${sqlString(kind)}, true, ${sortOrder})`,
    );
    sortOrder += 1;
  }
}

lines.push(rows.join(',\n') + ';');
lines.push('');

console.log(lines.join('\n'));
