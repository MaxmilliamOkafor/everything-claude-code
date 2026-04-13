export class RetryError extends Error {
  constructor(message, { cause, attempts } = {}) {
    super(message);
    this.name = 'RetryError';
    this.cause = cause;
    this.attempts = attempts;
  }
}

export class ToolError extends Error {
  constructor(tool, message, { cause } = {}) {
    super(`[tool:${tool}] ${message}`);
    this.name = 'ToolError';
    this.tool = tool;
    this.cause = cause;
  }
}

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}
