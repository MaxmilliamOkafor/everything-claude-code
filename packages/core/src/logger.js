import { inspect } from 'node:util';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

export function createLogger(name = 'claude', level = process.env.CLAUDE_LOG_LEVEL || 'info') {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const fmt = (lvl, args) => {
    const ts = new Date().toISOString();
    const tag = `[${ts}] [${name}] [${lvl}]`;
    const parts = args.map((a) => (typeof a === 'string' ? a : inspect(a, { depth: 4, colors: false })));
    return `${tag} ${parts.join(' ')}`;
  };
  const log = (lvl, stream) => (...args) => {
    if (LEVELS[lvl] < threshold) return;
    stream.write(fmt(lvl, args) + '\n');
  };
  return {
    debug: log('debug', process.stderr),
    info: log('info', process.stderr),
    warn: log('warn', process.stderr),
    error: log('error', process.stderr),
    child(suffix) { return createLogger(`${name}:${suffix}`, level); }
  };
}
