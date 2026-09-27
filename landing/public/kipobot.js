// Kipobot — widget de chat de la landing. Sin frameworks: es una landing
// estática, no tiene sentido cargar React solo para esto. Todo el mensaje
// pasa por /api/kipobot (función serverless) para que la API key de Gemini
// nunca viaje al navegador — si se llamara a Gemini directo desde aquí,
// cualquiera podría robar la key del código fuente y gastarla a nuestro nombre.
(function () {
  const launcher = document.getElementById('kipobot-launcher');
  const panel = document.getElementById('kipobot-panel');
  const closeBtn = document.getElementById('kipobot-close');
  const messagesEl = document.getElementById('kipobot-messages');
  const form = document.getElementById('kipobot-form');
  const input = document.getElementById('kipobot-input');
  const suggestions = document.getElementById('kipobot-suggestions');

  // Historial acotado (últimos 6 turnos) — suficiente contexto para que el
  // bot no repita preguntas, sin dejar crecer el costo de cada llamada sin
  // límite en una conversación larga.
  const history = [];
  let busy = false;

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'kipobot-msg ' + (role === 'user' ? 'user' : 'bot');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    busy = true;
    addMessage('user', trimmed);
    history.push({ role: 'user', text: trimmed });
    input.value = '';
    suggestions.style.display = 'none';

    const typing = document.createElement('div');
    typing.className = 'kipobot-msg bot';
    typing.textContent = 'Escribiendo...';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch('/api/kipobot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: history.slice(-12) }),
      });
      const data = await res.json();
      typing.remove();
      const reply = res.ok && data.reply
        ? data.reply
        : 'No pude responder justo ahora. Escríbenos a hola@kipoapp.com o intenta de nuevo en un momento.';
      addMessage('bot', reply);
      history.push({ role: 'bot', text: reply });
    } catch (err) {
      typing.remove();
      addMessage('bot', 'No pude conectarme. Intenta de nuevo en un momento.');
    } finally {
      busy = false;
    }
  }

  launcher.addEventListener('click', () => {
    panel.classList.add('open');
    launcher.style.display = 'none';
    input.focus();
  });
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
    launcher.style.display = 'flex';
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send(input.value);
  });
  suggestions.querySelectorAll('.kipobot-suggestion').forEach((btn) => {
    btn.addEventListener('click', () => send(btn.textContent));
  });
})();
