// Motor del bot de captura de gastos (reemplaza la lectura de SMS bancarios,
// que se quitó de la app por completo — ver conversación). En vez de que el
// usuario tenga que compartir manualmente una notificación bancaria, le
// cuenta el gasto a Kipobot en lenguaje natural y este endpoint lo convierte
// en una transacción estructurada, preguntando lo que falte antes de
// adivinar.
//
// Por qué es una función serverless y no una llamada directa a Gemini desde
// la app: la API key vive solo en la variable de entorno GEMINI_API_KEY de
// Vercel — si el cliente (nativo o web) llamara a Gemini directo, la key
// viajaría embebida en el bundle de la app y cualquiera podría extraerla y
// gastarla a nuestro nombre (a diferencia de una key de backend, esta sí es
// alcanzable por quien descompila un APK).
//
// Configurar en Vercel (Settings → Environment Variables):
//   GEMINI_API_KEY = <tu API key de https://aistudio.google.com/apikey>

const { parseExpense } = require('./_lib/expenseParser');

const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20; // más alto que kipobot.js: cada gasto real puede tomar 1-2 turnos de aclaración.

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ status: 'error', reason: 'rate_limited' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ status: 'error', reason: 'missing_api_key' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const message = typeof body?.message === 'string' ? body.message.slice(0, 1000) : '';
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const categories = Array.isArray(body?.categories) ? body.categories.slice(0, 200) : [];

  if (!message.trim()) {
    res.status(400).json({ status: 'error', reason: 'empty_message' });
    return;
  }
  if (categories.length === 0) {
    res.status(400).json({ status: 'error', reason: 'missing_categories' });
    return;
  }

  const result = await parseExpense({ message, history, categories, apiKey });
  res.status(result.httpStatus).json(result.body);
};
