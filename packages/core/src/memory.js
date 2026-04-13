import fs from 'node:fs';
import path from 'node:path';

/**
 * Long-term key/value memory with project scoping.
 * Stores facts, preferences, and project context that survive sessions.
 */
export class MemoryStore {
  constructor({ dir }) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  _file(scope) { return path.join(this.dir, `${scope.replace(/[^a-z0-9_-]/gi, '_')}.json`); }

  _load(scope) {
    const f = this._file(scope);
    if (!fs.existsSync(f)) return { facts: [], kv: {} };
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  }

  _save(scope, data) { fs.writeFileSync(this._file(scope), JSON.stringify(data, null, 2)); }

  remember(scope, fact) {
    const m = this._load(scope);
    const entry = { id: m.facts.length + 1, text: fact, ts: Date.now() };
    m.facts.push(entry);
    this._save(scope, m);
    return entry;
  }

  forget(scope, id) {
    const m = this._load(scope);
    m.facts = m.facts.filter((f) => f.id !== id);
    this._save(scope, m);
  }

  set(scope, key, value) {
    const m = this._load(scope);
    m.kv[key] = value;
    this._save(scope, m);
  }

  get(scope, key) {
    const m = this._load(scope);
    return m.kv[key];
  }

  all(scope) { return this._load(scope); }

  /** Returns a formatted memory block for injection into system prompts. */
  asContext(scope, limit = 40) {
    const m = this._load(scope);
    if (!m.facts.length && !Object.keys(m.kv).length) return '';
    const facts = m.facts.slice(-limit).map((f) => `- ${f.text}`).join('\n');
    const kv = Object.entries(m.kv).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n');
    return `# Persistent Memory (scope: ${scope})\n## Facts\n${facts || '(none)'}\n## Settings\n${kv || '(none)'}`.trim();
  }
}
