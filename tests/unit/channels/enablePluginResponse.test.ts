import { describe, expect, it } from 'vitest';
import { assertChannelBridgeSuccess } from '@/common/channel/channelBridgeResponse';

describe('assertChannelBridgeSuccess', () => {
  it('does not throw when success is true', () => {
    expect(() => assertChannelBridgeSuccess({ success: true })).not.toThrow();
  });

  it('does not throw when success field is absent', () => {
    expect(() => assertChannelBridgeSuccess({})).not.toThrow();
  });

  it('throws with backend error when success is false', () => {
    expect(() =>
      assertChannelBridgeSuccess({ success: false, error: 'secret is required' })
    ).toThrow('secret is required');
  });

  it('throws generic message when success is false without error text', () => {
    expect(() => assertChannelBridgeSuccess({ success: false })).toThrow('Channel operation failed');
  });
});
