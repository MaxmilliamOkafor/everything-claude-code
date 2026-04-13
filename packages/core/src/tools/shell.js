import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT = 120_000;
const DEFAULT_MAX_OUTPUT = 200_000;

export const shellTool = {
  name: 'run_shell',
  description: 'Execute a shell command and return stdout/stderr/exit code. Timeout defaults to 120s.',
  schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to run' },
      cwd: { type: 'string', description: 'Working directory (defaults to session cwd)' },
      timeoutMs: { type: 'integer', default: DEFAULT_TIMEOUT },
      env: { type: 'object', additionalProperties: { type: 'string' } }
    },
    required: ['command']
  },
  async run({ command, cwd, timeoutMs = DEFAULT_TIMEOUT, env = {} }, ctx = {}) {
    const workDir = cwd || ctx.cwd || process.cwd();
    return new Promise((resolve) => {
      const child = spawn(command, { shell: true, cwd: workDir, env: { ...process.env, ...env } });
      let stdout = '';
      let stderr = '';
      let truncated = false;
      const timer = setTimeout(() => { child.kill('SIGTERM'); truncated = true; }, timeoutMs);
      child.stdout.on('data', (d) => {
        stdout += d.toString();
        if (stdout.length > DEFAULT_MAX_OUTPUT) { stdout = stdout.slice(0, DEFAULT_MAX_OUTPUT); truncated = true; child.kill('SIGTERM'); }
      });
      child.stderr.on('data', (d) => {
        stderr += d.toString();
        if (stderr.length > DEFAULT_MAX_OUTPUT) { stderr = stderr.slice(0, DEFAULT_MAX_OUTPUT); truncated = true; }
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ command, cwd: workDir, exitCode: code, signal, stdout, stderr, truncated });
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ command, cwd: workDir, exitCode: -1, error: err.message, stdout, stderr, truncated });
      });
    });
  }
};
