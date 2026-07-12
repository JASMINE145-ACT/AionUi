import { describe, expect, it, beforeEach } from 'vitest';

// Prefer packaged examples/ tree; SYNC.001 keeps examples-wecom-dev identical.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const state = require('../../../examples/ext-wecom-aibot/channels/state') as {
  resetAll: () => void;
  setReplyContext: (streamId: string, context: { frame: unknown; streamId: string; chatId?: string }) => void;
  getReplyContext: (streamId: string) => { frame: unknown; streamId: string; chatId?: string } | null;
  clearReplyContext: (streamId: string) => void;
};

/**
 * WANd.WECOM.REPLY.CTX.USER.001
 *
 * Historical bug: callers passed group chatId as Map key, so concurrent @ in the
 * same group overwrote each other's SDK reply frame. Contract: key by streamId.
 */
describe('WANd.WECOM.REPLY.CTX.USER.001 — reply context keyed by streamId', () => {
  beforeEach(() => {
    state.resetAll();
  });

  it('keeps concurrent same-chatId contexts isolated by streamId', () => {
    const chatId = 'wr0xxxxx';
    const frameA = { msgid: 'a' };
    const frameB = { msgid: 'b' };

    state.setReplyContext('stream-a', { frame: frameA, streamId: 'stream-a', chatId });
    state.setReplyContext('stream-b', { frame: frameB, streamId: 'stream-b', chatId });

    expect(state.getReplyContext('stream-a')?.frame).toEqual(frameA);
    expect(state.getReplyContext('stream-b')?.frame).toEqual(frameB);
  });

  it('clearReplyContext only removes the target streamId', () => {
    state.setReplyContext('stream-a', { frame: { msgid: 'a' }, streamId: 'stream-a', chatId: 'g1' });
    state.setReplyContext('stream-b', { frame: { msgid: 'b' }, streamId: 'stream-b', chatId: 'g1' });

    state.clearReplyContext('stream-a');

    expect(state.getReplyContext('stream-a')).toBeNull();
    expect(state.getReplyContext('stream-b')?.streamId).toBe('stream-b');
  });

  it('does not treat chatId as a reply-context key (regression)', () => {
    const chatId = 'wr0xxxxx';
    state.setReplyContext('stream-a', { frame: { msgid: 'a' }, streamId: 'stream-a', chatId });
    // If someone mistakenly keys by chatId, this would return a context — must stay null.
    expect(state.getReplyContext(chatId)).toBeNull();
  });

  it('rejects empty streamId (fail closed)', () => {
    state.setReplyContext('', { frame: { msgid: 'x' }, streamId: '', chatId: 'g1' });
    expect(state.getReplyContext('')).toBeNull();
  });
});
