import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isAuthenticationFailureLog } = require('../../../examples-wecom-dev/ext-wecom-aibot/channels/sdk-runtime.js');

describe('sdk-runtime auth log detection', () => {
  it('detects WeCom 853000 authentication failure logs', () => {
    expect(
      isAuthenticationFailureLog([
        'Authentication failed: errcode=853000, errmsg=invalid bot_id or secret',
      ])
    ).toBe(true);
  });

  it('ignores unrelated log lines', () => {
    expect(isAuthenticationFailureLog(['Connecting to WebSocket'])).toBe(false);
  });
});
