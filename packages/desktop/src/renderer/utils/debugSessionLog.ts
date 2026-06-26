/** Debug session c39a5e — remove after replay bug verified fixed. */
export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string
): void {
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/0f7640a9-ab70-4223-8dc4-49239625f268', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c39a5e' },
    body: JSON.stringify({
      sessionId: 'c39a5e',
      location,
      message,
      data,
      timestamp: Date.now(),
      hypothesisId,
    }),
  }).catch(() => {});
  // #endregion
}

export function textPreview(value: unknown, max = 80): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}
