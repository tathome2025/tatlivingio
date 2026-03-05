(() => {
  const logEl = document.getElementById('chatbot-log');
  const formEl = document.getElementById('chatbot-form');
  const inputEl = document.getElementById('chatbot-input');
  if (!logEl || !formEl || !inputEl) return;

  const sessionId = localStorage.getItem('tat_chat_session') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('tat_chat_session', sessionId);
  const PENDING_KEY = 'tat_pending_transcript';

  const conversation = [];
  let handoffDone = false;
  let conversationClosed = false;

  const addMsg = (role, text) => {
    const div = document.createElement('div');
    div.className = `chat-msg ${role === 'user' ? 'user' : 'bot'}`;
    div.textContent = text;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
    conversation.push({ role, text, ts: new Date().toISOString() });
  };

  addMsg('bot', 'Hi, I am TAT AI Assistant. Before we continue, please leave your name and either email or phone for follow-up.');

  const hasContactInfo = (text) => {
    const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const phone = /(?:\+?\d[\d\s\-()]{6,}\d)/;
    const socialHint = /(whatsapp|wechat|telegram|line|contact me at|reach me at)/i;
    return email.test(text) || phone.test(text) || socialHint.test(text);
  };

  const hasNameInfo = (text) => {
    const nameHint = /\b(my name is|i am|i'm|this is)\s+[a-z][a-z\s.'-]{1,40}\b/i;
    const fullName = /\b[a-z]{2,20}\s+[a-z]{2,20}\b/i;
    return nameHint.test(text) || fullName.test(text);
  };

  const isCloseIntent = (text) => {
    return /\b(all good|all set|that'?s all|nothing else|done for now|no thanks|no thank you|we are good|good for now)\b/i.test(text);
  };

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

  const buildPayload = () => ({
    sessionId,
    transcriptId: `${sessionId}-${Date.now()}`,
    page: location.href,
    userAgent: navigator.userAgent,
    sentAt: new Date().toISOString(),
    conversation
  });

  const sendViaFetch = async (payload, keepalive = false) => {
    const res = await fetch('/api/send-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive
    });
    if (!res.ok) throw new Error(`send-transcript failed (${res.status})`);
  };

  const savePending = (payload) => {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(payload)); } catch {}
  };

  const clearPending = () => {
    try { localStorage.removeItem(PENDING_KEY); } catch {}
  };

  const flushPending = async () => {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      await sendViaFetch(payload, false);
      clearPending();
    } catch {}
  };

  flushPending();

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;
    inputEl.value = '';
    addMsg('user', message);

    if (conversationClosed) {
      conversationClosed = false;
    }

    const providedContactNow = hasContactInfo(message);
    const providedNameNow = hasNameInfo(message);

    if (!handoffDone && !(providedContactNow || providedNameNow)) {
      addMsg('bot', 'Before I answer, please share your name and either email or phone so our team can follow up.');
      return;
    }

    let justSharedContact = false;
    if (!handoffDone && (providedContactNow || providedNameNow)) {
      handoffDone = true;
      justSharedContact = true;
      const payload = buildPayload();
      savePending(payload);
      sendViaFetch(payload, false).then(clearPending).catch(() => {});
      addMsg('bot', 'Thanks for sharing your contact details. How can I help with your project?');
    }

    if (handoffDone && isCloseIntent(message)) {
      addMsg('bot', 'Great, have a good day. If you need anything else, just message me anytime.');
      conversationClosed = true;
      return;
    }

    const reply = await askAI(message);
    addMsg('bot', reply);

    if ((providedContactNow || providedNameNow) && !justSharedContact) {
      addMsg('bot', 'Thanks for sharing your contact details. Anything else I can help with?');
    }
  });

  let inFlight = false;
  const sendTranscript = () => {
    if (inFlight || conversation.length === 0) return;
    if (!conversation.some((m) => m.role === 'user')) return;
    inFlight = true;
    const payload = buildPayload();
    const serialized = JSON.stringify(payload);
    savePending(payload);

    if (navigator.sendBeacon) {
      try {
        navigator.sendBeacon('/api/send-transcript', serialized);
      } catch {}
    }

    sendViaFetch(payload, true)
      .then(clearPending)
      .catch(() => {})
      .finally(() => { inFlight = false; });
  };

  window.addEventListener('pagehide', sendTranscript);
  window.addEventListener('beforeunload', sendTranscript);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendTranscript();
  });
})();
