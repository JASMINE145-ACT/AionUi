import type { SlashCommandItem } from './types';

/**
 * CCB-Wanding commands are authoritative. Shell-only commands supplement
 * actions the backend does not expose and never override CCB names.
 */
export function mergeSlashCommands(
  agentCommands: readonly SlashCommandItem[],
  shellCommands: readonly SlashCommandItem[]
): SlashCommandItem[] {
  const map = new Map<string, SlashCommandItem>();

  for (const command of agentCommands) {
    map.set(command.name, command);
  }

  for (const command of shellCommands) {
    if (!map.has(command.name)) {
      map.set(command.name, command);
    }
  }

  return Array.from(map.values());
}
