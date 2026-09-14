// Diccionario de categorías y palabras clave usado por el parser de texto natural
// y como catálogo semilla para la tabla `categories` (ver database/schema.sql).
//
// Estructura: grupo -> { label, subcategories: { slug -> { label, keywords[] } } }
// El orden de los grupos define la PRIORIDAD de detección (ver expenseTextParser.mjs):
// el contexto social ("con mi esposa", "con niños", "con amigos") siempre gana sobre
// una palabra de comercio genérica, porque así lo pidió el usuario: un almuerzo con la
// esposa es "En Pareja", no simplemente "Alimentación fuera".

export const CATEGORY_GROUPS = {
  salidas_convivencia: {
    label: 'Salidas y Convivencia',
    kind: 'gasto',
    priority: 1,
    subcategories: {
      en_familia: {
        label: 'En Familia',
        keywords: [
          'familia', 'familiar', 'en familia', 'con mis hijos', 'con los niños',
          'niños', 'niñas', 'hijos', 'hija', 'hijo', 'nuestros hijos', 'paseo familiar',
        ],
      },
      en_pareja: {
        label: 'En Pareja',
        keywords: [
          'esposa', 'esposo', 'mi pareja', 'novia', 'novio', 'cita', 'aniversario',
          'mi mujer', 'mi marido',
        ],
      },
      personal_amigos: {
        label: 'Personales / Amigos',
        keywords: [
          'amigos', 'amigas', 'con mis amigos', 'con mis amigas', 'cerveza', 'cervezas',
          'bar', 'compas', 'panas',
        ],
      },
    },
  },
  transporte: {
    label: 'Transporte',
    kind: 'gasto',
    priority: 2,
    subcategories: {
      gasolina: { label: 'Gasolina', keywords: ['gasolina', 'combustible', 'gasolinera', 'gas del carro', 'bencina'] },
      parqueo: { label: 'Parqueos', keywords: ['parqueo', 'estacionamiento', 'parking'] },
      mantenimiento_auto: {
        label: 'Mantenimiento de auto',
        keywords: ['taller', 'mecanico', 'mecánico', 'cambio de aceite', 'llantas', 'frenos del carro'],
      },
    },
  },
  alimentacion_fuera: {
    label: 'Alimentación fuera',
    kind: 'gasto',
    priority: 3,
    subcategories: {
      comida_rapida: {
        label: 'Comida rápida',
        keywords: ['comida rapida', 'comida rápida', 'mcdonalds', 'burger', 'kfc', 'pollo campero', 'hamburguesa'],
      },
      cafeteria: { label: 'Cafeterías', keywords: ['cafe', 'café', 'cafeteria', 'cafetería', 'starbucks'] },
      domicilio: {
        label: 'Pedidos a domicilio',
        keywords: ['a domicilio', 'domicilio', 'delivery', 'rappi', 'pedidosya', 'uber eats'],
      },
      restaurante: {
        label: 'Restaurante',
        keywords: ['almuerzo', 'cena', 'restaurante', 'desayuno afuera'],
      },
      helados_snacks: { label: 'Helados y snacks', keywords: ['helados', 'helado', 'nieve', 'paleta'] },
    },
  },
  necesarios: {
    label: 'Gastos Necesarios / Diarios',
    kind: 'gasto',
    priority: 4,
    subcategories: {
      supermercado: { label: 'Supermercado', keywords: ['supermercado', 'super', 'mercado', 'despensa', 'walmart', 'pricesmart'] },
      farmacia: { label: 'Farmacia', keywords: ['farmacia', 'medicina', 'medicamento', 'medicamentos'] },
      mantenimiento_hogar: {
        label: 'Mantenimiento del hogar',
        keywords: ['plomero', 'electricista', 'ferreteria', 'ferretería', 'reparacion de la casa', 'reparación de la casa'],
      },
    },
  },
  fijos: {
    label: 'Gastos Fijos',
    kind: 'gasto',
    priority: 5,
    subcategories: {
      vivienda: { label: 'Vivienda', keywords: ['alquiler', 'renta', 'hipoteca'] },
      servicios: { label: 'Servicios', keywords: ['agua', 'luz', 'electricidad', 'internet', 'cable', 'gas de la casa'] },
      colegiaturas: { label: 'Colegiaturas', keywords: ['colegio', 'escuela', 'universidad', 'mensualidad del colegio', 'colegiatura'] },
      seguros: { label: 'Seguros', keywords: ['seguro', 'poliza', 'póliza'] },
      cuota_vehicular: { label: 'Cuota vehicular', keywords: ['cuota del carro', 'financiamiento del auto', 'prestamo del carro', 'préstamo del carro'] },
    },
  },
  // A diferencia de los grupos de arriba (gasto), estas subcategorías
  // solo se buscan cuando el texto ya fue determinado como ingreso — ver
  // detectIsIncome/INCOME_KEYWORDS en expenseTextParser.mjs. kind: 'ingreso'
  // es lo que separa este grupo del resto para el parser (flattenKeywords
  // vs flattenIncomeKeywords) y para el picker de categorías en la UI.
  ingresos: {
    label: 'Ingresos',
    kind: 'ingreso',
    priority: 1,
    subcategories: {
      salario: { label: 'Salario', keywords: ['salario', 'sueldo', 'nomina', 'nómina', 'quincena'] },
      aguinaldo: { label: 'Aguinaldo', keywords: ['aguinaldo'] },
      bono_vacacional: {
        label: 'Bono vacacional',
        keywords: ['bono vacacional', 'bono de vacaciones', 'pago de vacaciones', 'bono'],
      },
      remesas_familiares: {
        label: 'Remesas familiares',
        keywords: ['remesa', 'remesas', 'envio de dinero', 'envío de dinero', 'me enviaron dinero'],
      },
      reembolso: { label: 'Reembolso', keywords: ['reembolso', 'me reembolsaron', 'devolucion', 'devolución'] },
      otros_ingresos: { label: 'Otros ingresos', keywords: [] },
    },
  },
};

function flattenGroupsOfKind(kind) {
  const flat = [];
  for (const [groupSlug, group] of Object.entries(CATEGORY_GROUPS)) {
    if (group.kind !== kind) continue;
    for (const [subSlug, sub] of Object.entries(group.subcategories)) {
      for (const keyword of sub.keywords) {
        flat.push({ groupSlug, groupLabel: group.label, subSlug, subLabel: sub.label, keyword, priority: group.priority });
      }
    }
  }
  // La prioridad de grupo manda primero (el contexto social "esposa"/"hijos"/"amigos"
  // debe ganarle a una palabra de comercio genérica como "restaurante"), y dentro del
  // mismo grupo, las palabras clave más largas van primero para evitar coincidencias
  // parciales (que "comida rapida" no sea eclipsada por una coincidencia más corta).
  return flat.sort((a, b) => a.priority - b.priority || b.keyword.length - a.keyword.length);
}

// Aplana el diccionario a una lista ordenada por prioridad para que el parser
// solo tenga que iterar un arreglo plano de { groupSlug, subSlug, keyword }.
// Solo grupos de gasto — ver flattenIncomeKeywords para los de ingreso.
export function flattenKeywords() {
  return flattenGroupsOfKind('gasto');
}

// Misma idea que flattenKeywords, pero para las subcategorías de ingreso
// (ver detectIsIncome en expenseTextParser.mjs, que decide primero si el
// texto es un ingreso antes de intentar afinar cuál).
export function flattenIncomeKeywords() {
  return flattenGroupsOfKind('ingreso');
}
