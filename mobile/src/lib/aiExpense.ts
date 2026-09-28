// Cliente del bot de captura de gastos (api/parse-expense.js) — reemplaza la
// lectura de SMS bancarios que existía antes: en vez de leer una alerta del
// banco, la persona le cuenta el gasto a Kipobot y este servicio lo
// interpreta con IA, preguntando lo que falte en vez de adivinar.
//
// EXPO_PUBLIC_* se embebe en el bundle (público, no es un secreto — igual
// que EXPO_PUBLIC_SUPABASE_URL en lib/supabase.ts). Por default queda
// vacío para que el fetch sea relativo (mismo origen que sirvió la página)
// — /api/parse-expense vive junto al resto del sitio en el mismo dominio
// (ver vercel.json), sea cual sea ese dominio (kipoapp.com, el subdominio
// *.vercel.app mientras no se conecte el dominio final, un preview de PR,
// etc.). Un dominio absoluto hardcodeado aquí rompe el CSP connect-src
// 'self' de vercel.json en cuanto la página no se sirve exactamente desde
// ese dominio. Solo hace falta la env var si el backend algún día se sirve
// desde un dominio distinto al de la app.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';

const REQUEST_TIMEOUT_MS = 12_000;

export interface AiChatTurn {
  role: 'user' | 'bot';
  text: string;
}

export interface AiExpenseDraft {
  type: 'gasto' | 'ingreso';
  amount: number;
  merchant: string | null;
  description: string;
  groupSlug: string | null;
  subSlug: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export type AiExpenseResult =
  | { status: 'ready'; draft: AiExpenseDraft }
  | { status: 'needs_clarification'; question: string }
  | { status: 'error'; reason: string };

interface CategoryForAI {
  groupSlug: string;
  subSlug: string;
  label: string;
  kind: 'gasto' | 'ingreso';
}

// Sin red, con la API caída, o si Vercel todavía no tiene GEMINI_API_KEY
// configurada: el llamador (chat.tsx) cae automáticamente al parser local
// (parseExpenseWithFamilyRules) en cualquiera de estos casos — nunca deja a
// la persona sin poder registrar su gasto.
export async function parseExpenseWithAI(
  message: string,
  history: AiChatTurn[],
  categories: CategoryForAI[],
): Promise<AiExpenseResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/api/parse-expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, categories }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok || data.status === 'error') {
      return { status: 'error', reason: data?.reason || `http_${res.status}` };
    }
    return data as AiExpenseResult;
  } catch (err: any) {
    return { status: 'error', reason: err?.name === 'AbortError' ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(timeout);
  }
}
