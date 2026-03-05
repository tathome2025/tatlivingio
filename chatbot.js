(() => {
  const logEl = document.getElementById('chatbot-log');
  const formEl = document.getElementById('chatbot-form');
  const inputEl = document.getElementById('chatbot-input');
  if (!logEl || !formEl || !inputEl) return;

  const sessionId = localStorage.getItem('tat_chat_session') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('tat_chat_session', sessionId);

  const conversation = [];

  const addMsg = (role, text) => {
    const div = document.createElement('div');
    div.className = `chat-msg ${role === 'user' ? 'user' : 'bot'}`;
    div.textContent = text;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
    conversation.push({ role, text, ts: new Date().toISOString() });
  };

  addMsg('bot', 'Hi, I am TAT AI Assistant. Please tell me your project goal, timeline, and budget range.');

  const fallbackReply = (message) => {
    const lower = message.toLowerCase();
    if (lower.includes('price') || lower.includes('budget')) {
      return 'Please share your budget range (for example USD 10k-25k), and we will suggest the right scope.';
    }
    if (lower.includes('timeline') || lower.includes('deadline') || lower.includes('week')) {
      return 'Please share your target launch date. We can suggest a phased plan based on your must-have features.';
    }
    if (lower.includes('website') || lower.includes('app') || lower.includes('platform')) {
      return 'Great. Please share your target users and top 3 required features.';
    }
    return 'Thanks. Please also share your business type, timeline, budget, and any reference websites.';
  };

  const askAI = async (message) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversation })
      });
      if (!res.ok) throw new Error('chat api failed');
      const data = await res.json();
      return data.reply || fallbackReply(message);
    } catch {
      return fallbackReply(message);
    }
  };

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;
    inputEl.value = '';
    addMsg('user', message);
    const reply = await askAI(message);
    addMsg('bot', reply);
  });

  let sent = false;
  const sendTranscript = () => {
    if (sent || conversation.length === 0) return;
    sent = true;
    const payload = {
      sessionId,
      page: location.href,
      userAgent: navigator.userAgent,
      sentAt: new Date().toISOString(),
      conversation
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/send-transcript', blob);
      return;
    }

    fetch('/api/send-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  };

  window.addEventListener('pagehide', sendTranscript);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendTranscript();
  });
})();
