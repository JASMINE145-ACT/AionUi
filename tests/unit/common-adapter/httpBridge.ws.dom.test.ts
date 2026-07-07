/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const OPEN = 1;

type MockSocket = {
  url: string;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  emit: (type: string, event?: Partial<Event>) => void;
};

describe('httpBridge desktop WebSocket', () => {
  let instances: MockSocket[] = [];

  beforeEach(async () => {
    vi.resetModules();
    instances = [];
    (window as Window & { __backendPort?: number }).__backendPort = 13401;

    class MockWebSocket {
      static OPEN = OPEN;
      static CONNECTING = 0;
      url: string;
      readyState = 0;
      send = vi.fn();
      close = vi.fn(() => {
        this.readyState = 3;
      });
      private listeners = new Map<string, Set<(event: Event) => void>>();

      constructor(url: string) {
        this.url = url;
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

  it('connects to backend ws url when subscribing to an event', async () => {
    const { wsEmitter } = await import('@/common/adapter/httpBridge');

    wsEmitter('message.stream').on(() => {});

    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toBe('ws://127.0.0.1:13401/ws');
  });

  it('dispatches parsed ws payloads to registered listeners', async () => {
    const { wsEmitter } = await import('@/common/adapter/httpBridge');
    const handler = vi.fn();

    wsEmitter<{ id: string }>('message.stream').on(handler);

    const socket = instances[0]!;
    socket.emit('message', {
      data: JSON.stringify({ name: 'message.stream', data: { id: 'evt-1' } }),
    } as MessageEvent);

    expect(handler).toHaveBeenCalledWith({ id: 'evt-1' });
  });
});
