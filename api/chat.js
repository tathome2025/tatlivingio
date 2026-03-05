module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let parsedBody;
  try {
    parsedBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    parsedBody = {};
  }

  const { message, conversation = [] } = parsedBody;
  if (!message) {
    res.status(400).json({ error: 'Missing message' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({
      reply: 'Thanks. Please share your project goal, target timeline, and budget range, and we will follow up quickly.'
    });
    return;
  }

  const systemPrompt = [
    'You are TAT Living Limited AI assistant.',
    'Goal: qualify leads for AI design and technology projects.',
    'Be concise and ask practical follow-up questions.',
    'Collect: business type, project goals, timeline, budget, required features, and success metrics.',
    'Tone: professional, friendly, no fluff.'
  ].join(' ');

  const history = conversation
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        instructions: systemPrompt,
        input: `Conversation so far:\n${history}\n\nLatest user message: ${message}`
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const data = await response.json();
    const reply =
      data.output_text ||
      data.output?.flatMap((item) => item.content || [])
        .map((item) => item.text)
        .filter(Boolean)
        .join('\n') ||
      'Thanks. Could you share your timeline and budget range?';

    res.status(200).json({ reply });
  } catch {
    res.status(200).json({
      reply: 'Got it. Please also share your timeline, budget range, and top 3 required features so our team can propose the right scope.'
    });
  }
};
