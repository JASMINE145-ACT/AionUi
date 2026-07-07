/**
 * Main-process proxy for organization aioncore HTTP.
 * Electron renderer origins (e.g. http://localhost:5173) cannot call org VPS
 * without CORS; Node fetch from main has no browser CORS restriction.
 *
 * Org VPS (local=false) requires CSRF double-submit cookies on POST/PUT/DELETE.
 */

import { ipcMain } from 'electron';

import {
  ORG_FS_UPLOAD_CHANNEL,
  ORG_AUTH_CLEAR_CSRF_CHANNEL,
  ORG_HTTP_REQUEST_CHANNEL,
} from '@common/adapter/orgHttpBridge';
import { readOrgServerUrl } from '@process/utils/orgServerConfig';

const CSRF_COOKIE_NAME = 'aionui-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export type OrgHttpProxyRequest = {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export type OrgHttpProxyResponse = {
  ok: boolean;
  status: number;
  json?: unknown;
  text?: string;
  contentType?: string;
  error?: string;
};

export type OrgFsUploadRequest = {
  fileName: string;
  mimeType: string;
  base64: string;
  conversation_id?: string;
  headers?: Record<string, string>;
};

let orgCsrfToken: string | null = null;

export function clearOrgCsrfToken(): void {
  orgCsrfToken = null;
}

function getSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const raw = response.headers.get('set-cookie');
  return raw ? [raw] : [];
}

function captureCsrfFromSetCookies(setCookies: string[]): void {
  for (const line of setCookies) {
    const match = line.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (match?.[1]) {
      orgCsrfToken = decodeURIComponent(match[1]);
    }
  }
}

function applyCsrfHeaders(headers: Record<string, string>, method: string): void {
  const upper = method.toUpperCase();
  if (!orgCsrfToken || !['POST', 'PUT', 'DELETE', 'PATCH'].includes(upper)) {
    return;
  }
  headers[CSRF_HEADER_NAME] = orgCsrfToken;
  const existing = headers.Cookie ?? headers.cookie ?? '';
  const cookiePair = `${CSRF_COOKIE_NAME}=${orgCsrfToken}`;
  headers.Cookie = existing ? `${existing}; ${cookiePair}` : cookiePair;
  delete headers.cookie;
}

async function ensureOrgCsrfToken(baseUrl: string): Promise<void> {
  if (orgCsrfToken) {
    return;
  }
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/auth/status`, { method: 'GET' });
  captureCsrfFromSetCookies(getSetCookies(response));
}

function parseResponseBody(text: string): { json?: unknown; text?: string } {
  if (!text) {
    return {};
  }
  try {
    return { json: JSON.parse(text) };
  } catch {
    return { text };
  }
}

export async function proxyOrgHttpRequest(payload: OrgHttpProxyRequest): Promise<OrgHttpProxyResponse> {
  const baseUrl = readOrgServerUrl();
  if (!baseUrl) {
    return { ok: false, status: 0, error: 'ORG_SERVER_URL is not configured' };
  }

  const path = payload.path.startsWith('/') ? payload.path : `/${payload.path}`;
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = { ...(payload.headers ?? {}) };

  if (payload.body !== undefined && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    await ensureOrgCsrfToken(baseUrl);
    applyCsrfHeaders(headers, payload.method);

    const response = await fetch(url, {
      method: payload.method,
      headers,
      body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
    });

    captureCsrfFromSetCookies(getSetCookies(response));

    const text = await response.text();
    const parsed = parseResponseBody(text);

    return {
      ok: response.ok,
      status: response.status,
      json: parsed.json,
      text: parsed.text ?? text,
      contentType: response.headers.get('content-type') ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function proxyOrgFsUpload(payload: OrgFsUploadRequest): Promise<OrgHttpProxyResponse> {
  const baseUrl = readOrgServerUrl();
  if (!baseUrl) {
    return { ok: false, status: 0, error: 'ORG_SERVER_URL is not configured' };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/fs/upload`;
  const headers: Record<string, string> = { ...(payload.headers ?? {}) };

  try {
    await ensureOrgCsrfToken(baseUrl);
    applyCsrfHeaders(headers, 'POST');

    const buffer = Buffer.from(payload.base64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: payload.mimeType || 'application/octet-stream' }), payload.fileName);
    if (payload.conversation_id) {
      form.append('conversation_id', payload.conversation_id);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: form,
    });

    captureCsrfFromSetCookies(getSetCookies(response));

    const text = await response.text();
    const parsed = parseResponseBody(text);

    return {
      ok: response.ok,
      status: response.status,
      json: parsed.json,
      text: parsed.text ?? text,
      contentType: response.headers.get('content-type') ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export function registerOrgHttpProxyHandlers(): void {
  ipcMain.handle(ORG_HTTP_REQUEST_CHANNEL, async (_event, payload: OrgHttpProxyRequest) => {
    return proxyOrgHttpRequest(payload ?? { method: 'GET', path: '/' });
  });

  ipcMain.handle(ORG_FS_UPLOAD_CHANNEL, async (_event, payload: OrgFsUploadRequest) => {
    return proxyOrgFsUpload(payload ?? { fileName: 'file', mimeType: 'application/octet-stream', base64: '' });
  });

  ipcMain.handle(ORG_AUTH_CLEAR_CSRF_CHANNEL, () => {
    clearOrgCsrfToken();
    return { success: true };
  });
}
