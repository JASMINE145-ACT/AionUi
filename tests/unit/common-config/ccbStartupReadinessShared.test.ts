import { describe, expect, it } from 'vitest';
import {
  CCB_STARTUP_CORE_WARM_WORK_BUDGET_MS,
  CCB_STARTUP_CORE_WARM_WRAPPER_DEADLINE_MS,
  CCB_STARTUP_CORE_WARM_WRAPPER_GRACE_MS,
  isCcbStartupCoreMcpOk,
  isCcbStartupSendAllowed,
  isCcbStartupSoftReadyWarning,
  mergeWarmResultsOnTimeout,
  parseWarmWandingMcpStdout,
  type CcbStartupReadinessStatus,
} from '@/common/config/ccbStartupReadinessShared';

describe('ccbStartupReadinessShared', () => {
  it('keeps the core wrapper deadline beyond the warm-script work budget', () => {
    expect(CCB_STARTUP_CORE_WARM_WORK_BUDGET_MS).toBe(120_000);
    expect(CCB_STARTUP_CORE_WARM_WRAPPER_GRACE_MS).toBe(10_000);
    expect(CCB_STARTUP_CORE_WARM_WRAPPER_DEADLINE_MS).toBe(
      CCB_STARTUP_CORE_WARM_WORK_BUDGET_MS + CCB_STARTUP_CORE_WARM_WRAPPER_GRACE_MS
    );
    expect(CCB_STARTUP_CORE_WARM_WRAPPER_DEADLINE_MS).toBe(130_000);
  });

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

  it('treats quotation PASS as core mcp_ok even if accurate FAIL', () => {
    expect(
      isCcbStartupCoreMcpOk([
        { server: 'quotation', ok: true, ms: 20, detail: 'warmed' },
        { server: 'accurate', ok: false, ms: 5, detail: 'mcp package not found' },
      ])
    ).toBe(true);
  });

  it('fails core mcp_ok when quotation FAIL', () => {
    expect(
      isCcbStartupCoreMcpOk([
        { server: 'quotation', ok: false, ms: 1, detail: 'timeout' },
        { server: 'accurate', ok: true, ms: 9, detail: 'warmed' },
      ])
    ).toBe(false);
  });

  it('shows soft-ready warning only when soft_ready and not mcp_ok', () => {
    expect(
      isCcbStartupSoftReadyWarning({
        phase: 'ready',
        config_ok: true,
        mcp_ok: false,
        soft_ready: true,
      })
    ).toBe(true);
    expect(
      isCcbStartupSoftReadyWarning({
        phase: 'ready',
        config_ok: true,
        mcp_ok: true,
        soft_ready: false,
        error: 'accurate: fail',
      })
    ).toBe(false);
  });

  it('mergeWarmResultsOnTimeout keeps quotation PASS when accurate timed out', () => {
    const stdout =
      '[warm-wanding-mcp] PASS quotation 12108ms warmed\n';
    const merged = mergeWarmResultsOnTimeout(stdout, ['quotation', 'accurate'], 120_000);
    expect(merged.find((r) => r.server === 'quotation')?.ok).toBe(true);
    expect(merged.find((r) => r.server === 'accurate')?.ok).toBe(false);
    expect(isCcbStartupCoreMcpOk(merged)).toBe(true);
  });

  it('parseWarmWandingMcpStdout reads PASS/FAIL lines', () => {
    const rows = parseWarmWandingMcpStdout(
      '[warm-wanding-mcp] PASS quotation 10ms warmed\n[warm-wanding-mcp] FAIL accurate 1ms boom\n'
    );
    expect(rows).toEqual([
      { server: 'quotation', ok: true, ms: 10, detail: 'warmed' },
      { server: 'accurate', ok: false, ms: 1, detail: 'boom' },
    ]);
  });
});
