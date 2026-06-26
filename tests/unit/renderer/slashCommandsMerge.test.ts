import { describe, expect, it } from 'vitest';
import { mapAcpCommandToSlashCommand } from '@/common/chat/slash/acpMapping';
import { mergeSlashCommands } from '@/common/chat/slash/merge';
import {
  getSlashCommandBadgeKey,
  isSlashCommandExecutable,
  type SlashCommandItem,
} from '@/common/chat/slash/types';

const command = (
  name: string,
  source: SlashCommandItem['source'],
  overrides: Partial<SlashCommandItem> = {}
): SlashCommandItem => ({
  name,
  description: `${source} ${name}`,
  kind: source === 'aionui-shell' || source === 'builtin' ? 'builtin' : 'template',
  source,
  ...overrides,
});

describe('mergeSlashCommands', () => {
  it('keeps agent commands as the authority when names collide', () => {
    const merged = mergeSlashCommands([command('copy', 'acp')], [command('copy', 'aionui-shell')]);

    expect(merged).toEqual([command('copy', 'acp')]);
  });

  it('includes shell commands that are not provided by the agent', () => {
    const merged = mergeSlashCommands([command('review', 'acp')], [command('open', 'aionui-shell')]);

    expect(merged.map((item) => item.name)).toEqual(['review', 'open']);
  });
});

describe('capability slash mapping', () => {
  it('maps needs_mapping capabilities as visible but not executable', () => {
    const mapped = mapAcpCommandToSlashCommand({
      name: 'config',
      description: 'Open config panel',
      _meta: {
        capability: {
          source: 'ccb-wanding',
          status: 'needs_mapping',
          reason: 'requires_renderer_ui',
        },
      },
    });

    expect(mapped.capabilityStatus).toBe('needs_mapping');
    expect(isSlashCommandExecutable(mapped)).toBe(false);
    expect(getSlashCommandBadgeKey(mapped)).toBe('conversation.slash.badge.unsupported');
  });

  it('maps ready capabilities as executable', () => {
    const mapped = mapAcpCommandToSlashCommand({
      name: 'commit',
      description: 'Create a git commit',
      _meta: {
        capability: {
          source: 'ccb-wanding',
          status: 'ready',
        },
      },
    });

    expect(isSlashCommandExecutable(mapped)).toBe(true);
  });
});
