/**
 * Org-server JWT storage — separate from local aioncore session (authSession.ts).
 */

const ORG_SESSION_TOKEN_KEY = 'aionui-org-session-token';

let memoryToken: string | null = null;

export function setOrgSessionToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (token) {
      sessionStorage.setItem(ORG_SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ORG_SESSION_TOKEN_KEY);
    }
  } catch {
    // sessionStorage may be unavailable
  }
}

export function getOrgSessionToken(): string | null {
  if (memoryToken) {
    return memoryToken;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return sessionStorage.getItem(ORG_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearOrgSessionToken(): void {
  setOrgSessionToken(null);
}
