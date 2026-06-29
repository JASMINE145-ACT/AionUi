/**
 * HTTP bridge for organization aioncore (ORG_SERVER_URL).
 * Unified SSO: bearer token may live in aionui-session-token (same JWT as org-session).
 */

import { getOrgSessionToken } from '@/common/auth/orgAuthSession';
import { getSessionToken } from '@/common/auth/authSession';
import { isUnifiedOrgSsoEnabled } from '@/common/auth/ssoMode';
import {
  BackendHttpError,
  backendFetchCredentials,
  isBackendHttpError,
  type HttpRequestOptions,
} from '@/common/adapter/httpBridge';

/** IPC channel — must match `orgHttpProxy.ts` in main process. */
export const ORG_HTTP_REQUEST_CHANNEL = 'org-http-request';

type OrgHttpProxyRequest = {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};

type OrgHttpProxyResponse = {
  ok: boolean;
  status: number;
  json?: unknown;
  text?: string;
  contentType?: string;
  error?: string;
};

declare global {
  interface Window {
    __orgServerUrl?: string;
    electronAPI?: {
      invokeIpc?: (channel: string, data?: unknown) => Promise<unknown>;
    };
  }
}

export { BackendHttpError, isBackendHttpError };

export type OrgRawHttpResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function canUseOrgHttpProxy(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI?.invokeIpc === 'function';
}

async function orgRawFetchViaProxy(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<OrgRawHttpResponse> {
  const payload: OrgHttpProxyRequest = {
    method,
    path,
    body,
    headers: extraHeaders,
  };
  const result = (await window.electronAPI!.invokeIpc!(
    ORG_HTTP_REQUEST_CHANNEL,
    payload
  )) as OrgHttpProxyResponse;

  if (result.error && result.status === 0) {
    throw new TypeError(result.error);
  }

  const contentType = result.contentType ?? '';
  return {
    ok: result.ok,
    status: result.status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    json: async () => {
      if (result.json !== undefined) {
        return result.json;
      }
      if (result.text) {
        return JSON.parse(result.text);
      }
      return {};
    },
    text: async () => result.text ?? '',
  };
}

async function orgRawFetchViaBrowser(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<OrgRawHttpResponse> {
  const baseUrl = getOrgBaseUrl();
  if (!baseUrl) {
    throw new Error('ORG_SERVER_URL is not configured');
  }

  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = { ...(extraHeaders ?? {}) };
  if (body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: backendFetchCredentials(),
  });
}

/** Low-level org HTTP — prefers main-process proxy in Electron (no CORS). */
export async function orgRawFetch(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<OrgRawHttpResponse> {
  if (canUseOrgHttpProxy()) {
    return orgRawFetchViaProxy(method, path, body, extraHeaders);
  }
  return orgRawFetchViaBrowser(method, path, body, extraHeaders);
}

export function getOrgBaseUrl(): string {
  if (typeof window !== 'undefined' && window.__orgServerUrl) {
    return window.__orgServerUrl.replace(/\/$/, '');
  }
  const g = globalThis as typeof globalThis & { __orgServerUrl?: string };
  return (g.__orgServerUrl ?? '').replace(/\/$/, '');
}

export function isOrgServerConfigured(): boolean {
  return getOrgBaseUrl().length > 0;
}

export function getOrgBearerToken(): string | null {
  const orgToken = getOrgSessionToken();
  if (orgToken) {
    return orgToken;
  }
  if (isUnifiedOrgSsoEnabled()) {
    return getSessionToken();
  }
  return null;
}

export async function orgHttpRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: HttpRequestOptions
): Promise<T> {
  if (!isOrgServerConfigured() && !canUseOrgHttpProxy()) {
    throw new Error('ORG_SERVER_URL is not configured');
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const orgToken = getOrgBearerToken();
  if (orgToken) {
    headers.Authorization = `Bearer ${orgToken}`;
  }

  const response = await orgRawFetch(method, path, body, headers);

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    let errorBody: unknown;
    try {
      errorBody = JSON.parse(rawText);
    } catch {
      errorBody = rawText;
    }
    throw new BackendHttpError({ method, path, status: response.status, body: errorBody });
  }

  const contentType = response.headers.get('Content-Type');
  if (!contentType?.includes('application/json')) {
    return undefined as T;
  }

  const json = await response.json();
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

type ProviderLike<Data, Params> = {
  provider: (handler: (params: Params) => Promise<Data>) => void;
  invoke: Params extends undefined ? () => Promise<Data> : (params: Params) => Promise<Data>;
};

export function orgHttpGet<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  options?: HttpRequestOptions
): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const resolvedPath = typeof path === 'function' ? path(params!) : path;
      return orgHttpRequest<Data>('GET', resolvedPath, undefined, options);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

export function orgHttpPut<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  mapBody?: (params: Params) => unknown
): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const resolvedPath = typeof path === 'function' ? path(params!) : path;
      const body = mapBody ? mapBody(params!) : params;
      return orgHttpRequest<Data>('PUT', resolvedPath, body);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

export function orgHttpPost<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  mapBody?: (params: Params) => unknown
): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const resolvedPath = typeof path === 'function' ? path(params!) : path;
      const body = mapBody ? mapBody(params!) : params;
      return orgHttpRequest<Data>('POST', resolvedPath, body);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}
