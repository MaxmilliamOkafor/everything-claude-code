import fs from 'node:fs';
import path from 'node:path';

function isBinary(buffer) {
  const len = Math.min(buffer.length, 8000);
  for (let i = 0; i < len; i++) if (buffer[i] === 0) return true;
  return false;
}

export const searchTool = {
  name: 'grep_search',
  description: 'Recursively search a directory for a regex. Returns matching file paths with line numbers.',
  schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
      path: { type: 'string', default: '.' },
      glob: { type: 'string', description: 'Simple filename filter (e.g. *.js)' },
      caseInsensitive: { type: 'boolean', default: false },
      maxResults: { type: 'integer', default: 200 }
    },
    required: ['pattern']
  },
  async run({ pattern, path: p = '.', glob, caseInsensitive = false, maxResults = 200 }, { cwd = process.cwd() } = {}) {
    const root = path.resolve(cwd, p);
    const flags = caseInsensitive ? 'i' : '';
    const re = new RegExp(pattern, flags);
    const results = [];
    const globRe = glob ? new RegExp('^' + glob.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$') : null;
    const walk = (dir) => {
      if (results.length >= maxResults) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (globRe && !globRe.test(entry.name)) continue;
        let buf; try { buf = fs.readFileSync(full); } catch { continue; }
        if (isBinary(buf)) continue;
        const lines = buf.toString('utf8').split(/\r?\n/);
        lines.forEach((line, idx) => {
          if (results.length >= maxResults) return;
          if (re.test(line)) results.push({ file: path.relative(root, full), line: idx + 1, text: line.slice(0, 400) });
        });
      }
    };
    walk(root);
    return { root, pattern, count: results.length, matches: results };
  }
};
