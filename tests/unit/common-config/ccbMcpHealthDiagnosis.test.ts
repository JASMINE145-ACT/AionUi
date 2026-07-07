import { describe, expect, it } from 'vitest';
import type { CcbMcpHealthReport } from '@/common/config/ccbMcpHealth';
import { diagnoseCcbMcpHealth, buildMinimaxPromptForReport } from '@/common/config/ccbMcpHealthDiagnosis';

function makeReport(items: CcbMcpHealthReport['config']['items']): CcbMcpHealthReport {
  const ok = items.every((item) => item.ok);
  return {
    ok,
    checked_at: '2026-06-18T00:00:00.000Z',
    config: { ok, items },
  };
}

describe('ccbMcpHealthDiagnosis', () => {
  it('returns empty plan when all checks pass', () => {
    const report = makeReport([
      { layer: 'config', id: 'mcp:quotation', ok: true, detail: 'registered' },
    ]);
    const diagnosis = diagnoseCcbMcpHealth(report);
    expect(diagnosis.ok).toBe(true);
    expect(diagnosis.repair_plan).toEqual([]);
  });

  it('maps missing MCP registration to ensure-wanding-settings', () => {
    const report = makeReport([
      { layer: 'config', id: 'mcp:office-word', ok: false, detail: 'not in settings.json mcpServers' },
    ]);
    const diagnosis = diagnoseCcbMcpHealth(report);
    expect(diagnosis.ok).toBe(false);
    expect(diagnosis.repair_plan).toContain('ensure-wanding-settings');
    expect(diagnosis.items[0]?.severity).toBe('fixable');
  });

  it('maps missing agent sidecar to deploy-seed-agents', () => {
    const report = makeReport([
      {
        layer: 'agents',
        id: 'word-creator',
        ok: false,
        detail: 'missing sidecar C:\\agents\\word-creator.aionui.json',
      },
    ]);
    const diagnosis = diagnoseCcbMcpHealth(report);
    expect(diagnosis.repair_plan).toEqual(['deploy-seed-agents']);
  });

  it('marks missing vendor files as manual', () => {
    const report = makeReport([
      {
        layer: 'files',
        id: 'office-word/vendor/mcp-servers/office-word-mcp/server.py',
        ok: false,
        detail: 'missing: D:\\CCB-Wanding\\vendor\\...',
      },
    ]);
    const diagnosis = diagnoseCcbMcpHealth(report);
    expect(diagnosis.items[0]?.severity).toBe('manual');
    expect(diagnosis.repair_plan).toEqual([]);
    expect(diagnosis.minimax_prompt).toContain('office-word');
  });

  it('orders repair plan deterministically', () => {
    const report = makeReport([
      { layer: 'agents', id: 'word-creator', ok: false, detail: 'sidecar mcp_allowlist missing: office-word' },
      { layer: 'config', id: 'mcp:excel', ok: false, detail: 'not in settings.json mcpServers' },
    ]);
    const diagnosis = diagnoseCcbMcpHealth(report);
    expect(diagnosis.repair_plan[0]).toBe('ensure-wanding-settings');
    expect(diagnosis.repair_plan).toContain('repair-word-creator');
  });

  it('maps CCB_PROJECT_ROOT failure to ensure-wanding-settings', () => {
    const report = makeReport([
      {
        layer: 'config',
        id: 'quotation.env.CCB_PROJECT_ROOT',
        ok: false,
        detail: 'python/main.py missing under D:\\wrong',
      },
    ]);
    const diagnosis = diagnoseCcbMcpHealth(report);
    expect(diagnosis.repair_plan).toEqual(['ensure-wanding-settings']);
    expect(diagnosis.items[0]?.next_step).toBe('repair');
  });

  it('maps session missing mcp to new_guid next step', () => {
    const report: CcbMcpHealthReport = {
      ok: false,
      checked_at: '2026-06-18T00:00:00.000Z',
      config: { ok: true, items: [] },
      session: {
        ok: false,
        items: [
          {
            layer: 'session',
            id: 'word-creator',
            ok: false,
            detail: 'missing mcp: office-word',
          },
        ],
      },
    };
    const diagnosis = diagnoseCcbMcpHealth(report);
    expect(diagnosis.items[0]?.next_step).toBe('new_guid');
    expect(diagnosis.minimax_prompt).toContain('会话探针');
  });

  it('maps .env.accurate file failure to ensure-wanding-settings', () => {
    const report: CcbMcpHealthReport = {
      ok: false,
      checked_at: '2026-06-18T00:00:00.000Z',
      config: { ok: true, items: [] },
      files: {
        ok: false,
        items: [
          {
            layer: 'files',
            id: 'quotation/vendor/wanding/.env.accurate',
            ok: false,
            detail: 'missing: D:\\CCB-Wanding\\vendor\\wanding\\.env.accurate',
          },
        ],
      },
    };
    const diagnosis = diagnoseCcbMcpHealth(report);
    expect(diagnosis.repair_plan).toEqual(['ensure-wanding-settings']);
    expect(diagnosis.items[0]?.severity).toBe('fixable');
  });

  it('includes auto-repair log in minimax prompt', () => {
    const report = makeReport([
      { layer: 'probe', id: 'office-word', ok: false, detail: 'connection failed' },
    ]);
    const prompt = buildMinimaxPromptForReport(report, {
      autoRepair: {
        steps: [
          { id: 'ensure-wanding-settings', ok: true, detail: 'settings.json refreshed' },
          { id: 'deploy-seed-agents', ok: true, detail: 'agent seeds deployed' },
        ],
      },
    });
    expect(prompt).toContain('已自动执行的白名单修复');
    expect(prompt).toContain('ensure-wanding-settings');
    expect(prompt).toContain('office-word');
  });
});
