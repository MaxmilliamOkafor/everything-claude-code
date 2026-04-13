import { MemoryStore } from '../memory.js';
import { loadConfig } from '../config.js';

function store() { return new MemoryStore({ dir: loadConfig().memoryDir }); }

export const memoryTools = [
  {
    name: 'memory_remember',
    description: 'Store a long-lived fact in persistent memory scoped to a project/context.',
    schema: { type: 'object', properties: { scope: { type: 'string' }, fact: { type: 'string' } }, required: ['scope', 'fact'] },
    async run({ scope, fact }) { return store().remember(scope, fact); }
  },
  {
    name: 'memory_recall',
    description: 'Retrieve all stored facts and settings for a given scope.',
    schema: { type: 'object', properties: { scope: { type: 'string' } }, required: ['scope'] },
    async run({ scope }) { return store().all(scope); }
  },
  {
    name: 'memory_forget',
    description: 'Delete a stored fact by id.',
    schema: { type: 'object', properties: { scope: { type: 'string' }, id: { type: 'integer' } }, required: ['scope', 'id'] },
    async run({ scope, id }) { store().forget(scope, id); return { ok: true }; }
  }
];
