import { fileTools } from './file.js';
import { editTool } from './edit.js';
import { shellTool } from './shell.js';
import { searchTool } from './search.js';
import { fetchTool } from './fetch.js';
import { browserTools } from './browser.js';
import { memoryTools } from './memory-tool.js';
import { ToolError } from '../errors.js';

const REGISTRY = new Map();

function register(tool) { REGISTRY.set(tool.name, tool); }

[...fileTools, editTool, shellTool, searchTool, fetchTool, ...browserTools, ...memoryTools].forEach(register);

export const TOOLS = REGISTRY;

export function listTools(filter) {
  const all = [...REGISTRY.values()];
  if (!filter) return all;
  return all.filter((t) => filter[t.name] !== false);
}

export function getTool(name) { return REGISTRY.get(name); }

export function registerTool(tool) {
  if (!tool?.name || !tool?.schema || typeof tool?.run !== 'function') {
    throw new ToolError('register', 'Tool requires { name, schema, run }');
  }
  REGISTRY.set(tool.name, tool);
}

export function toolsAsAnthropicSchema(filter) {
  return listTools(filter).map((t) => ({ name: t.name, description: t.description, input_schema: t.schema }));
}

export async function runTool(name, input, ctx = {}) {
  const tool = REGISTRY.get(name);
  if (!tool) throw new ToolError(name, 'Unknown tool');
  try {
    const result = await tool.run(input || {}, ctx);
    return result;
  } catch (err) {
    throw new ToolError(name, err.message, { cause: err });
  }
}
