import { describe, expect, it } from 'vitest';
import { buildExtensionEnableConfig } from '@/renderer/components/settings/SettingsModal/contents/channels/extensionEnableConfig';

describe('buildExtensionEnableConfig', () => {
  it('passes through all fields when credentials are not yet saved', () => {
    const config = buildExtensionEnableConfig(
      { botId: 'bot-1', secret: 'sec-1', custom_agent_id: 'quotation-agent' },
      false
    );

    expect(config).toEqual({
      botId: 'bot-1',
      secret: 'sec-1',
      custom_agent_id: 'quotation-agent',
    });
  });

  it('filters empty UI fields when hasToken without stored merge (legacy behavior)', () => {
    const config = buildExtensionEnableConfig({ botId: 'bot-1', secret: '' }, true);

    expect(config).toEqual({ botId: 'bot-1' });
  });

  it('merges stored secret when UI secret field is blank after prior save', () => {
    const config = buildExtensionEnableConfig(
      { botId: 'bot-1', secret: '', custom_agent_id: 'quotation-agent' },
      true,
      { botId: 'bot-1', secret: 'stored-secret', custom_agent_id: 'quotation-agent' }
    );

    expect(config).toEqual({
      botId: 'bot-1',
      secret: 'stored-secret',
      custom_agent_id: 'quotation-agent',
    });
  });

  it('prefers non-empty UI secret over stored secret', () => {
    const config = buildExtensionEnableConfig(
      { botId: 'bot-1', secret: 'new-secret' },
      true,
      { botId: 'bot-1', secret: 'stored-secret' }
    );

    expect(config.secret).toBe('new-secret');
  });
});
