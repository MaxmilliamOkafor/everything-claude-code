// Central model registry. Update here to surface new Claude models across CLI, Cowork, and the extension.
export const MODELS = Object.freeze({
  'claude-opus-4-6': {
    id: 'claude-opus-4-6',
    family: 'opus',
    label: 'Claude Opus 4.6',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    capabilities: ['tools', 'vision', 'streaming', 'extended-thinking'],
    default: true
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    family: 'sonnet',
    label: 'Claude Sonnet 4.6',
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    capabilities: ['tools', 'vision', 'streaming', 'extended-thinking']
  },
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    family: 'haiku',
    label: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    maxOutputTokens: 8_000,
    capabilities: ['tools', 'vision', 'streaming']
  },
  'claude-opus-4-5': {
    id: 'claude-opus-4-5',
    family: 'opus',
    label: 'Claude Opus 4.5',
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    capabilities: ['tools', 'vision', 'streaming']
  },
  'claude-sonnet-4-5': {
    id: 'claude-sonnet-4-5',
    family: 'sonnet',
    label: 'Claude Sonnet 4.5',
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    capabilities: ['tools', 'vision', 'streaming']
  }
});

export const DEFAULT_MODEL = 'claude-opus-4-6';

export function resolveModel(idOrAlias) {
  if (!idOrAlias) return MODELS[DEFAULT_MODEL];
  if (MODELS[idOrAlias]) return MODELS[idOrAlias];
  const alias = String(idOrAlias).toLowerCase();
  const match = Object.values(MODELS).find((m) => m.family === alias || m.label.toLowerCase() === alias);
  return match || MODELS[DEFAULT_MODEL];
}

export function listModels() {
  return Object.values(MODELS);
}
