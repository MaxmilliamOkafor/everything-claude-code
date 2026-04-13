import fs from 'node:fs';
import path from 'node:path';

/**
 * Surgical string-replace edit tool. Requires the old_string to be unique in the file
 * to prevent ambiguous edits. Supports replace_all for global renames.
 */
export const editTool = {
  name: 'edit_file',
  description: 'Edit an existing file by replacing an exact string. old_string must match uniquely unless replace_all=true.',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      old_string: { type: 'string' },
      new_string: { type: 'string' },
      replace_all: { type: 'boolean', default: false }
    },
    required: ['path', 'old_string', 'new_string']
  },
  async run({ path: p, old_string, new_string, replace_all = false }, { cwd = process.cwd() } = {}) {
    const abs = path.resolve(cwd, p);
    const src = fs.readFileSync(abs, 'utf8');
    const count = src.split(old_string).length - 1;
    if (count === 0) throw new Error('old_string not found in file');
    if (count > 1 && !replace_all) throw new Error(`old_string appears ${count}x; set replace_all=true or add more context`);
    const out = replace_all ? src.split(old_string).join(new_string) : src.replace(old_string, new_string);
    fs.writeFileSync(abs, out);
    return { path: abs, replacements: replace_all ? count : 1 };
  }
};
