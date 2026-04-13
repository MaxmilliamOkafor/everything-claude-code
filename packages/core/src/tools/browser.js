import { fetchTool } from './fetch.js';

/**
 * Browser tools provide structured interaction with web pages.
 * In Node.js these are implemented on top of fetch + HTML parsing; in the browser
 * extension they are replaced by live DOM access via the content script bridge.
 */

function pickLinks(html, baseUrl) {
  const re = /<a[^>]+href="([^"#?]+)(?:[?#][^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi;
  const links = [];
  let m;
  while ((m = re.exec(html)) && links.length < 120) {
    const href = m[1];
    let abs = href;
    try { abs = new URL(href, baseUrl).toString(); } catch { continue; }
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    links.push({ href: abs, text: text.slice(0, 120) });
  }
  return links;
}

export const browserTools = [
  {
    name: 'browse',
    description: 'Load a URL and return the cleaned page text, title, and a list of outbound links for navigation.',
    schema: {
      type: 'object',
      properties: { url: { type: 'string' }, maxChars: { type: 'integer', default: 40000 } },
      required: ['url']
    },
    async run({ url, maxChars = 40000 }) {
      const res = await fetchTool.run({ url, mode: 'raw' });
      const html = typeof res.content === 'string' ? res.content : '';
      const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [, ''])[1].trim();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxChars);
      const links = pickLinks(html, res.url);
      return { url: res.url, status: res.status, title, text, links };
    }
  },
  {
    name: 'web_search',
    description: 'Search the web via DuckDuckGo HTML and return a list of { title, url, snippet }.',
    schema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'integer', default: 10 } },
      required: ['query']
    },
    async run({ query, limit = 10 }) {
      const url = 'https://duckduckgo.com/html/?q=' + encodeURIComponent(query);
      const res = await fetchTool.run({ url, mode: 'raw', headers: { 'user-agent': 'Mozilla/5.0 ClaudeEcosystem/1.0' } });
      const html = typeof res.content === 'string' ? res.content : '';
      const results = [];
      const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = re.exec(html)) && results.length < limit) {
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        const snippet = m[3].replace(/<[^>]+>/g, '').trim();
        let href = m[1];
        try { const u = new URL(href); href = u.searchParams.get('uddg') || href; } catch {}
        results.push({ title, url: href, snippet });
      }
      return { query, count: results.length, results };
    }
  }
];
