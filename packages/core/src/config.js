import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigError } from './errors.js';

export const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude-ecosystem');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.CLAUDE_MODEL || 'claude-opus-4-6',
  maxTokens: 8192,
  temperature: 0.7,
  sessionDir: path.join(CONFIG_DIR, 'sessions'),
  memoryDir: path.join(CONFIG_DIR, 'memory'),
  logsDir: path.join(CONFIG_DIR, 'logs'),
  tools: { shell: true, file: true, edit: true, search: true, browser: true, fetch: true },
  cowork: { port: 7777, host: '127.0.0.1' },
  extension: { syncEndpoint: 'http://127.0.0.1:7777/api' }
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function loadConfig(overrides = {}) {
  ensureDir(CONFIG_DIR);
  let file = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try { file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
    catch (err) { throw new ConfigError(`Invalid config at ${CONFIG_PATH}: ${err.message}`); }
  }
  const merged = { ...DEFAULTS, ...file, ...overrides };
  ensureDir(merged.sessionDir);
  ensureDir(merged.memoryDir);
  ensureDir(merged.logsDir);
  return merged;
}

export function saveConfig(patch) {
  const current = loadConfig();
  const next = { ...current, ...patch };
  // Never persist the API key to disk unless explicit
  if (!patch.persistApiKey) delete next.apiKey;
  ensureDir(CONFIG_DIR);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}
