const MAX_BYTES = 2_000_000;
const MAX_RETURN = 400_000;

function stripHtml(html) {
  // Strip scripts/styles, then tags; collapse whitespace.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}

export const fetchTool = {
  name: 'fetch_url',
  description: 'Fetch a URL and return normalized text content. Respects timeout and size limits.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      method: { type: 'string', default: 'GET' },
      headers: { type: 'object' },
      body: { type: 'string' },
      mode: { type: 'string', enum: ['text', 'html', 'json', 'raw'], default: 'text' },
      timeoutMs: { type: 'integer', default: 20000 }
    },
    required: ['url']
  },
  async run({ url, method = 'GET', headers = {}, body, mode = 'text', timeoutMs = 20000 }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'user-agent': 'ClaudeEcosystem/1.0', ...headers },
        body,
        signal: controller.signal,
        redirect: 'follow'
      });
      const contentType = res.headers.get('content-type') || '';
      const reader = res.body?.getReader();
      let received = 0;
      const chunks = [];
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.length;
          if (received > MAX_BYTES) break;
          chunks.push(value);
        }
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const raw = buf.toString('utf8');
      let content = raw;
      let title = '';
      if (mode === 'text' || (mode !== 'raw' && contentType.includes('text/html'))) {
        title = extractTitle(raw);
        content = stripHtml(raw);
      } else if (mode === 'json') {
        try { content = JSON.parse(raw); } catch { /* fall through to text */ }
      }
      const text = typeof content === 'string' ? content.slice(0, MAX_RETURN) : content;
      return { url: res.url, status: res.status, contentType, title, bytes: buf.length, content: text };
    } finally {
      clearTimeout(timer);
    }
  }
};
