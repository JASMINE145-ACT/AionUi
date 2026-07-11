/**
 * Build extension plugin enable payload from UI field values.
 * When credentials were previously saved (hasToken), blank secret fields must
 * merge from stored config — see WANd.WECOM.ENABLE.002.
 */
export function buildExtensionEnableConfig(
  fieldValues: Record<string, unknown>,
  hasToken: boolean,
  storedConfig?: Record<string, unknown>
): Record<string, unknown> {
  if (!hasToken) {
    return { ...fieldValues };
  }

  const filtered = Object.fromEntries(
    Object.entries(fieldValues).filter(([, value]) => value !== undefined && value !== '')
  );

  if (!storedConfig) {
    return filtered;
  }

  const merged = { ...storedConfig, ...filtered };
  for (const [key, value] of Object.entries(fieldValues)) {
    if ((value === undefined || value === '') && storedConfig[key] !== undefined) {
      merged[key] = storedConfig[key];
    }
  }
  return merged;
}
