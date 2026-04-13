import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class SessionStore {
  constructor({ dir }) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  _path(id) { return path.join(this.dir, `${id}.json`); }

  create({ title = 'Untitled', model, systemPrompt = '', metadata = {} } = {}) {
    const id = crypto.randomBytes(8).toString('hex');
    const session = {
      id,
      title,
      model,
      systemPrompt,
      metadata,
      messages: [],
      toolCalls: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    fs.writeFileSync(this._path(id), JSON.stringify(session, null, 2));
    return session;
  }

  get(id) {
    const p = this._path(id);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  update(id, patch) {
    const s = this.get(id);
    if (!s) throw new Error(`Session ${id} not found`);
    Object.assign(s, patch, { updatedAt: Date.now() });
    fs.writeFileSync(this._path(id), JSON.stringify(s, null, 2));
    return s;
  }

  append(id, message) {
    const s = this.get(id);
    if (!s) throw new Error(`Session ${id} not found`);
    s.messages.push(message);
    s.updatedAt = Date.now();
    fs.writeFileSync(this._path(id), JSON.stringify(s, null, 2));
    return s;
  }

  list() {
    return fs.readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  delete(id) {
    const p = this._path(id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  export(id) { return this.get(id); }
}
