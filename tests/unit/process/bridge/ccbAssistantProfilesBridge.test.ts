import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CCB_NEXT_ASSISTANT_PROFILE_FILE } from '@/common/config/ccbAssistantProfileSession';
import type { CcbAssistantProfileInput } from '@/common/config/ccbAssistantProfiles';

const providers = vi.hoisted(() => ({
  saveProfile: null as ((profile: CcbAssistantProfileInput) => Promise<unknown>) | null,
  stageNextSessionProfile: null as ((args: { profile_id: string }) => Promise<void>) | null,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    ccbAssistantProfilesService: {
      listProfiles: { provider: vi.fn() },
      getProfile: { provider: vi.fn() },
      saveProfile: {
        provider: (fn: (profile: CcbAssistantProfileInput) => Promise<unknown>) => {
          providers.saveProfile = fn;
        },
      },
      deleteProfile: { provider: vi.fn() },
      stageNextSessionProfile: {
        provider: (fn: (args: { profile_id: string }) => Promise<void>) => {
          providers.stageNextSessionProfile = fn;
        },
      },
    },
  },
}));

function withTempConfigDir(run: (dir: string) => Promise<void> | void) {
  const previous = process.env.CCB_WANDING_CONFIG_DIR;
  const dir = mkdtempSync(join(tmpdir(), 'ccb-wanding-profiles-bridge-'));
  writeFileSync(join(dir, 'settings.json'), '{}\n', 'utf8');
  process.env.CCB_WANDING_CONFIG_DIR = dir;
  return Promise.resolve(run(dir)).finally(() => {
    if (previous === undefined) {
      delete process.env.CCB_WANDING_CONFIG_DIR;
    } else {
      process.env.CCB_WANDING_CONFIG_DIR = previous;
    }
  });
}

describe('ccbAssistantProfilesBridge', () => {
  beforeEach(async () => {
    providers.saveProfile = null;
    providers.stageNextSessionProfile = null;
    vi.resetModules();
    const { initCcbAssistantProfilesBridge } = await import('@/process/bridge/ccbAssistantProfilesBridge');
    initCcbAssistantProfilesBridge();
  });

  afterEach(() => {
    delete process.env.CCB_WANDING_CONFIG_DIR;
  });

  it('save-new-agent-via-wrapper writes agents md+sidecar for new profiles', async () => {
    await withTempConfigDir(async (dir) => {
      expect(providers.saveProfile).not.toBeNull();

      const saved = (await providers.saveProfile!({
        id: 'new-wrapper-agent',
        name: 'New Wrapper Agent',
        instructions: { system_prompt: 'You are a new agent.' },
        recommended_prompts: ['Hello'],
        defaults: {
          skills: { enabled: ['quote-helper'], disabled: [] },
          mcp: { enabled: ['quotation'], disabled: [] },
        },
      })) as { id: string; name: string };

      expect(saved.id).toBe('new-wrapper-agent');
      expect(saved.name).toBe('New Wrapper Agent');
      expect(existsSync(join(dir, 'agents', 'new-wrapper-agent.md'))).toBe(true);
      expect(existsSync(join(dir, 'agents', 'new-wrapper-agent.aionui.json'))).toBe(true);
      expect(existsSync(join(dir, 'assistants', 'new-wrapper-agent.json'))).toBe(false);

      const md = readFileSync(join(dir, 'agents', 'new-wrapper-agent.md'), 'utf8');
      expect(md).toContain('You are a new agent.');
    });
  });

  it('stageNextSessionProfile delegates to stageNextSessionAgent handoff file', async () => {
    await withTempConfigDir(async (dir) => {
      expect(providers.stageNextSessionProfile).not.toBeNull();

      await providers.stageNextSessionProfile!({ profile_id: 'quotation-agent' });

      const handoffPath = join(dir, CCB_NEXT_ASSISTANT_PROFILE_FILE);
      expect(existsSync(handoffPath)).toBe(true);
      const payload = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(payload.profile_id).toBe('quotation-agent');
      expect(typeof payload.staged_at).toBe('string');
    });
  });
});
