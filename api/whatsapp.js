// Kipobot por WhatsApp: el mismo bot de captura de gastos de la app, pero
// por mensajes de WhatsApp (WhatsApp Business Cloud API de Meta).
//
// Flujo:
//   1. La persona genera un código en la app (Más → WhatsApp) y le manda
//      "VINCULAR AB12CD34" al número del bot → queda enlazado su teléfono.
//   2. Cualquier otro mensaje de ese teléfono se interpreta como un gasto:
//      se llama al mismo motor que usa la app (_lib/expenseParser), se guarda
//      la transacción en el espacio elegido y se responde con un resumen.
//   3. "espacio" lista sus espacios y "espacio 2" cambia a cuál se registra —
//      cada espacio es independiente, nada se mezcla.
//
// Variables de entorno en Vercel (ver docs/WHATSAPP.md):
//   WHATSAPP_VERIFY_TOKEN     texto cualquiera, el mismo que se pone en Meta al registrar el webhook
//   WHATSAPP_APP_SECRET       "App secret" de la app de Meta (firma de cada request)
//   WHATSAPP_TOKEN            token de acceso (permanente) de la WhatsApp Cloud API
//   WHATSAPP_PHONE_NUMBER_ID  id del número emisor (no es el teléfono, es un id numérico de Meta)
//   SUPABASE_URL              https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY clave service_role — SOLO en el servidor: se salta RLS, por eso
//                             todo acceso de abajo se filtra a mano por el teléfono ya verificado
//   GEMINI_API_KEY            la misma que usa /api/parse-expense

const crypto = require('crypto');
const { parseExpense } = require('./_lib/expenseParser');

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const PENDING_TTL_MS = 10 * 60_000;
const KIND_TO_GROUP = {
  fijo: 'fijos',
  necesario: 'necesarios',
  transporte: 'transporte',
  alimentacion_fuera: 'alimentacion_fuera',
  salidas_convivencia: 'salidas_convivencia',
  ingreso: 'ingresos',
};

// ---------------------------------------------------------------------------
// Supabase por REST (sin dependencia nueva en el servidor)
// ---------------------------------------------------------------------------

async function db(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`supabase ${method} ${path} -> ${res.status} ${await res.text().catch(() => '')}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const enc = encodeURIComponent;

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

async function reply(to, text) {
  const res = await fetch(`${GRAPH_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });
  if (!res.ok) console.error('whatsapp send error', res.status, await res.text().catch(() => ''));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function validSignature(raw, header) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const given = header.slice('sha256='.length);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Límite por teléfono: sin esto, un número vinculado (o uno que adivine el
// formato) podría gastar la cuota de Gemini/WhatsApp mandando mensajes en bucle.
const hits = new Map();
function rateLimited(phone) {
  const now = Date.now();
  const entry = hits.get(phone);
  if (!entry || now - entry.start > 60_000) {
    hits.set(phone, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 20;
}

// ---------------------------------------------------------------------------
// Lógica del bot
// ---------------------------------------------------------------------------

async function memberships(authUserId) {
  const rows = await db(
    `users?select=id,family_id,role,families(name)&auth_user_id=eq.${authUserId}&status=eq.active&order=created_at.asc`,
  );
  return rows.map((r) => ({ membershipId: r.id, familyId: r.family_id, name: r.families?.name || 'Espacio' }));
}

async function handleLink(from, code) {
  const rows = await db(`whatsapp_link_codes?select=*&code=eq.${enc(code.toUpperCase())}`);
  const row = rows[0];
  if (!row || new Date(row.expires_at) < new Date()) {
    await reply(from, 'Ese código no es válido o ya venció. Genera uno nuevo en la app: Más → WhatsApp.');
    return;
  }
  await db('whatsapp_links?on_conflict=phone', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { phone: from, auth_user_id: row.auth_user_id, family_id: row.family_id, pending: null, pending_at: null },
  });
  await db(`whatsapp_link_codes?code=eq.${enc(row.code)}`, { method: 'DELETE' });
  const [family] = await db(`families?select=name&id=eq.${row.family_id}`);
  await reply(
    from,
    `¡Listo! Tu WhatsApp quedó vinculado a "${family?.name ?? 'tu espacio'}". Cuéntame un gasto como lo dirías en voz alta, por ejemplo: "Super Selectos 51".\n\nEscribe "espacio" para ver o cambiar de espacio.`,
  );
}

async function handleSpaces(link, text) {
  const spaces = await memberships(link.auth_user_id);
  const pick = text.match(/\d+/);
  if (pick) {
    const chosen = spaces[Number(pick[0]) - 1];
    if (chosen) {
      await db(`whatsapp_links?phone=eq.${link.phone}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { family_id: chosen.familyId, pending: null, pending_at: null },
      });
      await reply(link.phone, `Listo, ahora registro en "${chosen.name}".`);
      return;
    }
  }
  const lines = spaces.map((s, i) => `${i + 1}. ${s.name}${s.familyId === link.family_id ? ' ✅' : ''}`);
  await reply(link.phone, `Tus espacios:\n${lines.join('\n')}\n\nPara cambiar, escribe "espacio 2" (el número que quieras).`);
}

async function loadCategories(familyId) {
  const rows = await db(`categories?select=slug,kind,name&or=(family_id.is.null,family_id.eq.${familyId})`);
  return rows.map((r) => ({
    groupSlug: KIND_TO_GROUP[r.kind] ?? r.kind,
    subSlug: r.slug,
    label: r.name,
    kind: r.kind === 'ingreso' ? 'ingreso' : 'gasto',
  }));
}

async function handleExpense(link, text, messageId) {
  // Meta reintenta una entrega si no recibe 200 a tiempo — sin esta
  // revisión, un reintento registraría el mismo gasto dos veces.
  const dup = await db(`transactions?select=id&family_id=eq.${link.family_id}&metadata->>whatsapp_message_id=eq.${enc(messageId)}&limit=1`);
  if (dup.length > 0) return;

  const spaces = await memberships(link.auth_user_id);
  const space = spaces.find((s) => s.familyId === link.family_id);
  if (!space) {
    await reply(link.phone, 'Ya no tienes acceso a ese espacio. Escribe "espacio" para elegir otro.');
    return;
  }

  const pendingFresh = link.pending && link.pending_at && Date.now() - new Date(link.pending_at).getTime() < PENDING_TTL_MS;
  const history = pendingFresh ? link.pending : [];

  const categories = await loadCategories(link.family_id);
  const result = await parseExpense({ message: text, history, categories, apiKey: process.env.GEMINI_API_KEY });

  if (result.body.status === 'needs_clarification') {
    const next = [...history, { role: 'user', text }, { role: 'bot', text: result.body.question }].slice(-8);
    await db(`whatsapp_links?phone=eq.${link.phone}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { pending: next, pending_at: new Date().toISOString() },
    });
    await reply(link.phone, result.body.question);
    return;
  }

  if (result.body.status !== 'ready') {
    await reply(link.phone, 'Tuve un problema para procesar tu mensaje. Inténtalo de nuevo en un momento.');
    return;
  }

  const d = result.body.draft;
  const [family] = await db(`families?select=base_currency&id=eq.${link.family_id}`);
  let categoryId = null;
  let categoryLabel = null;
  if (d.groupSlug && d.subSlug) {
    const match = categories.find((c) => c.groupSlug === d.groupSlug && c.subSlug === d.subSlug);
    categoryLabel = match?.label ?? null;
    const kind = Object.keys(KIND_TO_GROUP).find((k) => KIND_TO_GROUP[k] === d.groupSlug) ?? d.groupSlug;
    const found = await db(
      `categories?select=id&slug=eq.${enc(d.subSlug)}&kind=eq.${enc(kind)}&or=(family_id.is.null,family_id.eq.${link.family_id})&limit=1`,
    );
    categoryId = found[0]?.id ?? null;
  }

  const needsReview = d.confidence !== 'high';
  await db('transactions', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      family_id: link.family_id,
      user_id: space.membershipId,
      type: d.type,
      amount: d.amount,
      currency: family?.base_currency || 'USD',
      category_id: categoryId,
      merchant: d.merchant,
      description: d.description,
      raw_text: [...history.map((h) => h.text), text].join(' · '),
      source: 'chat',
      status: needsReview ? 'pendiente' : 'confirmado',
      occurred_at: new Date().toISOString(),
      metadata: { confidence: d.confidence, channel: 'whatsapp', whatsapp_message_id: messageId },
    },
  });
  await db(`whatsapp_links?phone=eq.${link.phone}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { pending: null, pending_at: null },
  });

  const sign = d.type === 'ingreso' ? '+' : '';
  const where = categoryLabel ? ` · ${categoryLabel}` : '';
  const review = needsReview ? '\n\n⚠️ Quedó pendiente de confirmar: revísalo en la app.' : '';
  await reply(link.phone, `✅ ${sign}$${Number(d.amount).toFixed(2)}${where}\n${d.description}\nEspacio: ${space.name}${review}`);
}

async function handleMessage(msg) {
  const from = String(msg.from || '').replace(/\D/g, '');
  if (!from) return;
  if (rateLimited(from)) return;

  if (msg.type !== 'text' || !msg.text?.body) {
    await reply(from, 'Por ahora solo entiendo mensajes de texto. Escríbeme el gasto, por ejemplo: "Gasolina 40".');
    return;
  }
  const text = msg.text.body.trim().slice(0, 500);

  const linkMatch = text.match(/^vincular\s+([a-z0-9]{6,12})$/i);
  if (linkMatch) {
    await handleLink(from, linkMatch[1]);
    return;
  }

  const [link] = await db(`whatsapp_links?select=*&phone=eq.${from}`);
  if (!link) {
    await reply(from, 'Aún no te conozco 🙂 Abre Kipo → Más → WhatsApp, genera tu código y mándamelo aquí como "VINCULAR TUCÓDIGO".');
    return;
  }

  if (/^espacios?(\s+\d+)?$/i.test(text)) {
    await handleSpaces(link, text);
    return;
  }

  await handleExpense(link, text, msg.id);
}

module.exports = async (req, res) => {
  // Verificación inicial del webhook (Meta llama con GET al registrarlo).
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query || {};
    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('forbidden');
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('method_not_allowed');
    return;
  }

  const raw = await readRawBody(req);
  if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
    res.status(401).send('invalid_signature');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    res.status(400).send('invalid_json');
    return;
  }

  const messages = (payload.entry || []).flatMap((e) => (e.changes || []).flatMap((c) => c.value?.messages || []));
  for (const msg of messages) {
    try {
      await handleMessage(msg);
    } catch (err) {
      console.error('whatsapp handler error', err);
    }
  }

  // Siempre 200: si no, Meta reintenta la misma entrega una y otra vez.
  res.status(200).send('ok');
};

// La firma de Meta se calcula sobre el cuerpo EXACTO (bytes) — si Vercel lo
// parseara antes, JSON.stringify no reproduciría los mismos bytes. Va después
// de `module.exports = ...` porque esa asignación reemplaza el objeto entero.
module.exports.config = { api: { bodyParser: false } };
