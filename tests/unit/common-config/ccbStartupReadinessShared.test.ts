import { describe, expect, it } from 'vitest';
import {
  isCcbStartupSendAllowed,
  type CcbStartupReadinessStatus,
} from '@/common/config/ccbStartupReadinessShared';

describe('ccbStartupReadinessShared', () => {
  it('allows send when phase is ready', () => {
    const status: CcbStartupReadinessStatus = {
      phase: 'ready',
      config_ok: true,
      mcp_ok: true,
      soft_ready: false,
    };
    expect(isCcbStartupSendAllowed(status)).toBe(true);
  });

  it('blocks send while warming', () => {
    const status: CcbStartupReadinessStatus = {
      phase: 'mcp_warm',
      config_ok: true,
      mcp_ok: false,
      soft_ready: false,
    };
    expect(isCcbStartupSendAllowed(status)).toBe(false);
  });

  it('allows soft-ready after MCP timeout', () => {
    const status: CcbStartupReadinessStatus = {
      phase: 'ready',
      config_ok: true,
      mcp_ok: false,
      soft_ready: true,
    };
    expect(isCcbStartupSendAllowed(status)).toBe(true);
  });

  it('blocks config error', () => {
    const status: CcbStartupReadinessStatus = {
      phase: 'error',
      config_ok: false,
      mcp_ok: false,
      soft_ready: false,
      error: 'missing settings',
    };
    expect(isCcbStartupSendAllowed(status)).toBe(false);
  });
});
