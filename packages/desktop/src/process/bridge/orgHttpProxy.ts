/**
 * Main-process proxy for organization aioncore HTTP.
 * Electron renderer origins (e.g. http://localhost:5173) cannot call org VPS
 * without CORS; Node fetch from main has no browser CORS restriction.
 */

import { ipcMain } from 'electron';

import { ORG_HTTP_REQUEST_CHANNEL } from '@common/adapter/orgHttpBridge';
import { readOrgServerUrl } from '@process/utils/orgServerConfig';

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
    const response = await fetch(url, {
      method: payload.method,
      headers,
      body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
    });

    const text = await response.text();
    let json: unknown;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
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
}
