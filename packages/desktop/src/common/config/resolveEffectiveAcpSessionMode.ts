/**
 * Prefer the live ACP session mode (AgentModeSelector / getMode) over the
 * conversation.extra.session_mode snapshot captured at create time.
 */
export function resolveEffectiveAcpSessionMode(
  liveMode: string | undefined,
  storedMode: string | undefined,
): string | undefined {
  const live = liveMode?.trim();
  if (live) return live;
  const stored = storedMode?.trim();
  return stored || undefined;
}
