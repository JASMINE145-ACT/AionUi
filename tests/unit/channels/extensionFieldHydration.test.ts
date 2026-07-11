import { describe, expect, it } from 'vitest';
import type { IChannelPluginStatus } from '@/common/types/channel/channel';
import {
  hydrateExtensionFieldValues,
  savedFieldValuesFromStatus,
} from '@/renderer/components/settings/SettingsModal/contents/channels/extensionFieldHydration';

describe('extensionFieldHydration', () => {
  it('extracts primitive saved field values from plugin status', () => {
    const saved = savedFieldValuesFromStatus({
      savedFieldValues: {
        botId: 'bot-1',
        wsUrl: 'wss://example.test',
        strictGroupAt: true,
        ignored: { nested: true },
      },
    });

    expect(saved).toEqual({
      botId: 'bot-1',
      wsUrl: 'wss://example.test',
      strictGroupAt: true,
    });
  });

  it('hydrates empty extension fields from saved plugin status without overwriting user input', () => {
    const plugin = {
      type: 'ext-wecom-aibot',
      savedFieldValues: { botId: 'bot-1', wsUrl: 'wss://example.test' },
    } as IChannelPluginStatus;

    const hydrated = hydrateExtensionFieldValues(
      {
        'ext-wecom-aibot': { botId: 'user-typed', secret: '' },
      },
      [plugin]
    );

    expect(hydrated['ext-wecom-aibot']).toEqual({
      botId: 'user-typed',
      secret: '',
      wsUrl: 'wss://example.test',
    });
  });

  it('fills missing botId from saved status after settings reload', () => {
    const plugin = {
      type: 'ext-wecom-aibot',
      savedFieldValues: { botId: 'bot-1' },
    } as IChannelPluginStatus;

    const hydrated = hydrateExtensionFieldValues({}, [plugin]);

    expect(hydrated['ext-wecom-aibot']).toEqual({ botId: 'bot-1' });
  });
});
