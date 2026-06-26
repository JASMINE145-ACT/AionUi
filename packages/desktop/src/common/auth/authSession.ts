/**
 * Session token storage for desktop direct-to-backend HTTP (127.0.0.1).
 * WebUI mode relies on same-origin cookies; Bearer is used when a token is present.
 */

const SESSION_TOKEN_KEY = 'aionui-session-token';

let memoryToken: string | null = null;

export function setSessionToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

export function getSessionToken(): string | null {
  if (memoryToken) {
    return memoryToken;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearSessionToken(): void {
  setSessionToken(null);
}
