import fs from 'node:fs';
import path from 'node:path';

function resolveSafe(cwd, p) {
  const abs = path.resolve(cwd, p);
  return abs;
}

export const fileTools = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from disk. Returns UTF-8 text plus metadata.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or workspace-relative path' },
        offset: { type: 'integer', description: 'Start line (1-indexed)', default: 1 },
        limit: { type: 'integer', description: 'Max lines to return', default: 2000 }
      },
      required: ['path']
    },
    async run({ path: p, offset = 1, limit = 2000 }, { cwd = process.cwd() } = {}) {
      const abs = resolveSafe(cwd, p);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) throw new Error(`${p} is a directory`);
      const data = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
      const slice = data.slice(Math.max(0, offset - 1), Math.max(0, offset - 1) + limit);
      return { path: abs, bytes: stat.size, totalLines: data.length, startLine: offset, lines: slice.length, content: slice.join('\n') };
    }
  },
  {
    name: 'write_file',
    description: 'Create a new file or overwrite an existing file with the provided content.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        createDirs: { type: 'boolean', default: true }
      },
      required: ['path', 'content']
    },
    async run({ path: p, content, createDirs = true }, { cwd = process.cwd() } = {}) {
      const abs = resolveSafe(cwd, p);
      if (createDirs) fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      return { path: abs, bytes: Buffer.byteLength(content) };
    }
  },
  {
    name: 'list_directory',
    description: 'List files and directories at the given path. Returns names, types, and sizes.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', default: '.' },
        recursive: { type: 'boolean', default: false },
        maxEntries: { type: 'integer', default: 500 }
      }
    },
    async run({ path: p = '.', recursive = false, maxEntries = 500 }, { cwd = process.cwd() } = {}) {
      const abs = resolveSafe(cwd, p);
      const results = [];
      const walk = (dir) => {
        if (results.length >= maxEntries) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.git') || entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          const rel = path.relative(abs, full);
          const stat = fs.statSync(full);
          results.push({ path: rel || entry.name, type: entry.isDirectory() ? 'dir' : 'file', size: stat.size });
          if (recursive && entry.isDirectory()) walk(full);
          if (results.length >= maxEntries) break;
        }
      };
      walk(abs);
      return { root: abs, count: results.length, entries: results };
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file (not a directory). Returns path on success.',
    schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    async run({ path: p }, { cwd = process.cwd() } = {}) {
      const abs = resolveSafe(cwd, p);
      fs.unlinkSync(abs);
      return { path: abs, deleted: true };
    }
  }
];
