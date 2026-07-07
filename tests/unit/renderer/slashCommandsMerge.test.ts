import { describe, expect, it } from 'vitest';
import { mapAcpCommandToSlashCommand } from '@/common/chat/slash/acpMapping';
import { mergeSlashCommands } from '@/common/chat/slash/merge';
import type { SlashCommandItem } from '@/common/chat/slash/types';

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

describe('mapAcpCommandToSlashCommand', () => {
  it('maps ACP available_commands entries to template slash items', () => {
    const mapped = mapAcpCommandToSlashCommand({
      name: 'commit',
      description: 'Create a git commit',
      input: { hint: 'message' },
    });

    expect(mapped).toEqual({
      name: 'commit',
      description: 'Create a git commit',
      kind: 'template',
      source: 'acp',
      selectionBehavior: 'insert',
      hint: 'message',
    });
  });
});
