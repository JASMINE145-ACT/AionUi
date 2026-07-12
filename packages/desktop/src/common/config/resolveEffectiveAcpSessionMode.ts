/**
 * Prefer the live ACP session mode (AgentModeSelector / getMode) over the
 * conversation.extra.session_mode snapshot captured at create time.
 */

import { normalizeAcpPermissionMode } from '@/common/config/normalizeAcpPermissionMode';

export function resolveEffectiveAcpSessionMode(
  liveMode: string | undefined,
  storedMode: string | undefined,
  backend?: string,
): string | undefined {
  const live = normalizeAcpPermissionMode(backend, liveMode);
  if (live) return live;
  const stored = normalizeAcpPermissionMode(backend, storedMode);
  return stored || undefined;
}
