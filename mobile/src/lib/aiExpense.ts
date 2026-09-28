// Cliente del bot de captura de gastos (api/parse-expense.js) — reemplaza la
// lectura de SMS bancarios que existía antes: en vez de leer una alerta del
// banco, la persona le cuenta el gasto a Kipobot y este servicio lo
// interpreta con IA, preguntando lo que falte en vez de adivinar.
//
// EXPO_PUBLIC_* se embebe en el bundle (público, no es un secreto — igual
// que EXPO_PUBLIC_SUPABASE_URL en lib/supabase.ts) y por default apunta al
// dominio de producción de la landing, donde vive /api/parse-expense junto
// al resto del sitio (ver vercel.json). Solo hace falta cambiar la env var
// si el backend se sirve desde otro dominio.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://kipoapp.com';

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
