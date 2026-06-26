/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setSessionToken, clearSessionToken } from '@/common/auth/authSession';

const OPEN = 1;

type MockSocket = {
  url: string;
  protocols?: string[];
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  emit: (type: string, event?: Partial<Event>) => void;
};

describe('httpBridge desktop WebSocket auth', () => {
  let instances: MockSocket[] = [];

  beforeEach(async () => {
    vi.resetModules();
    instances = [];
    clearSessionToken();
    (window as Window & { __backendPort?: number }).__backendPort = 13401;

    class MockWebSocket {
      static OPEN = OPEN;
      static CONNECTING = 0;
      url: string;
      protocols?: string[];
      readyState = 0;
      send = vi.fn();
      close = vi.fn(() => {
        this.readyState = 3;
      });
      private listeners = new Map<string, Set<(event: Event) => void>>();

      constructor(url: string, protocols?: string[]) {
        this.url = url;
        this.protocols = protocols;
        instances.push(this as unknown as MockSocket);
      }

      addEventListener(type: string, handler: (event: Event) => void) {
        if (!this.listeners.has(type)) {
          this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(handler);
      }

      emit(type: string, event: Partial<Event> = {}) {
        for (const handler of this.listeners.get(type) ?? []) {
          handler(event as Event);
        }
      }
    }

    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  it('passes desktop session token via Sec-WebSocket-Protocol', async () => {
    setSessionToken('desktop-jwt-token');
    const { wsEmitter } = await import('@/common/adapter/httpBridge');

    wsEmitter('message.stream').on(() => {});

    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toBe('ws://127.0.0.1:13401/ws');
    expect(instances[0]?.protocols).toEqual(['desktop-jwt-token']);
  });

  it('replies to server ping with pong', async () => {
    setSessionToken('desktop-jwt-token');
    const { wsEmitter } = await import('@/common/adapter/httpBridge');

    wsEmitter('message.stream').on(() => {});

    const socket = instances[0]!;
    socket.readyState = OPEN;
    socket.emit('message', {
      data: JSON.stringify({ name: 'ping', data: { timestamp: 123 } }),
    } as MessageEvent);

    expect(socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"name":"pong"')
    );
  });

  it('reconnectWebSocket reconnects with the latest session token', async () => {
    const { wsEmitter, reconnectWebSocket } = await import('@/common/adapter/httpBridge');

    wsEmitter('message.stream').on(() => {});
    expect(instances).toHaveLength(0);

    setSessionToken('after-login-token');
    reconnectWebSocket();

    expect(instances).toHaveLength(1);
    expect(instances[0]?.protocols).toEqual(['after-login-token']);
  });
});
