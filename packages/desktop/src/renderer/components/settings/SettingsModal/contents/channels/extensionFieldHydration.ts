import type { IChannelPluginStatus } from '@/common/types/channel/channel';

export type ExtensionFieldValues = Record<string, Record<string, string | number | boolean>>;

function normalizeSavedFieldValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

export function savedFieldValuesFromStatus(
  status: Pick<IChannelPluginStatus, 'savedFieldValues'>
): Record<string, string | number | boolean> {
  const raw = status.savedFieldValues;
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const next: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeSavedFieldValue(value);
    if (normalized !== undefined) {
      next[key] = normalized;
    }
  }
  return next;
}

export function hydrateExtensionFieldValues(
  prev: ExtensionFieldValues,
  plugins: IChannelPluginStatus[]
): ExtensionFieldValues {
  const next: ExtensionFieldValues = { ...prev };

  for (const plugin of plugins) {
    const pluginType = plugin.type;
    const saved = savedFieldValuesFromStatus(plugin);
    if (Object.keys(saved).length === 0) {
      continue;
    }

    if (!next[pluginType]) {
      next[pluginType] = {};
    }

    for (const [key, value] of Object.entries(saved)) {
      const current = next[pluginType][key];
      if (current === undefined || current === '') {
        next[pluginType][key] = value;
      }
    }
  }

  return next;
}
