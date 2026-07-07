/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Map MCP health failures → human diagnosis + whitelisted repair actions.
 */

import {
  collectCcbMcpHealthFailedItems,
  collectCcbMcpHealthWarnItems,
  type CcbMcpHealthItem,
  type CcbMcpHealthReport,
} from './ccbMcpHealthShared';

/** Whitelisted repair actions — only these may run from UI one-click repair. */
export const CCB_MCP_HEALTH_REPAIR_ACTION_IDS = [
  'ensure-wanding-settings',
  'deploy-seed-agents',
  'repair-word-creator',
  'repair-excel-creator',
  'repair-subagent-mcp',
] as const;

export type CcbMcpHealthRepairActionId = (typeof CCB_MCP_HEALTH_REPAIR_ACTION_IDS)[number];

export type CcbMcpHealthDiagnosisItem = {
  /** Stable key: `${layer}:${id}` */
  key: string;
  layer: CcbMcpHealthItem['layer'];
  id: string;
  title: string;
  detail: string;
  /** fixable = whitelisted repair may help; manual = user/vendor action required */
  severity: 'fixable' | 'manual';
  repair_action_ids: CcbMcpHealthRepairActionId[];
  /** UI hint: repair | new_guid | cli_session */
  next_step?: 'repair' | 'new_guid' | 'cli_session' | 'manual';
};

export type CcbMcpHealthDiagnosis = {
  ok: boolean;
  failed_count: number;
  summary: string;
  items: CcbMcpHealthDiagnosisItem[];
  /** Deduped, ordered whitelist actions for one-click repair */
  repair_plan: CcbMcpHealthRepairActionId[];
  minimax_prompt: string;
};

const REPAIR_ORDER: CcbMcpHealthRepairActionId[] = [
  'ensure-wanding-settings',
  'deploy-seed-agents',
  'repair-subagent-mcp',
  'repair-word-creator',
  'repair-excel-creator',
];

function orderRepairActions(ids: Iterable<CcbMcpHealthRepairActionId>): CcbMcpHealthRepairActionId[] {
  const set = new Set(ids);
  return REPAIR_ORDER.filter((id) => set.has(id));
}

function diagnoseItem(item: CcbMcpHealthItem): CcbMcpHealthDiagnosisItem {
  const key = `${item.layer}:${item.id}`;
  const base = {
    key,
    layer: item.layer,
    id: item.id,
    detail: item.detail,
    repair_action_ids: [] as CcbMcpHealthRepairActionId[],
    severity: 'manual' as const,
    title: item.id,
    next_step: 'manual' as const,
  };

  if (item.layer === 'config' && item.id.startsWith('mcp:')) {
    return {
      ...base,
      title: `MCP 未注册：${item.id.slice(4)}`,
      severity: 'fixable',
      next_step: 'repair',
      repair_action_ids: ['ensure-wanding-settings', 'repair-subagent-mcp'],
    };
  }

  if (item.id === 'quotation.env.CCB_PROJECT_ROOT') {
    return {
      ...base,
      title: '报价 MCP Python 路径错误',
      severity: 'fixable',
      next_step: 'repair',
      repair_action_ids: ['ensure-wanding-settings'],
    };
  }

  if (item.layer === 'files') {
    const isEnvAccurate =
      item.id.includes('.env.accurate') ||
      item.detail.includes('AOL_ACCESS_TOKEN parsed') ||
      item.detail.includes('BOM');
    if (isEnvAccurate) {
      return {
        ...base,
        title: 'AOL 凭证文件 (.env.accurate) 异常',
        severity: 'fixable',
        next_step: 'repair',
        repair_action_ids: ['ensure-wanding-settings'],
      };
    }
    return {
      ...base,
      title: `安装文件缺失：${item.id}`,
      severity: 'manual',
      next_step: 'manual',
      repair_action_ids: [],
    };
  }

  if (item.layer === 'agents') {
    if (item.detail.includes('missing sidecar') || item.detail.startsWith('missing ')) {
      return {
        ...base,
        title: `专家助手未部署：${item.id}`,
        severity: 'fixable',
        next_step: 'repair',
        repair_action_ids: ['deploy-seed-agents'],
      };
    }
    if (item.detail.includes('mcp_allowlist missing')) {
      const actions: CcbMcpHealthRepairActionId[] = ['repair-subagent-mcp'];
      if (item.id === 'word-creator') actions.push('repair-word-creator');
      if (item.id === 'excel-creator') actions.push('repair-excel-creator');
      return {
        ...base,
        title: `助手 MCP 白名单错误：${item.id}`,
        severity: 'fixable',
        next_step: 'repair',
        repair_action_ids: actions,
      };
    }
    if (item.detail.includes('invalid sidecar')) {
      return {
        ...base,
        title: `助手 sidecar 损坏：${item.id}`,
        severity: 'fixable',
        next_step: 'repair',
        repair_action_ids: ['deploy-seed-agents'],
      };
    }
  }

  if (item.layer === 'session') {
    const handoffHint =
      item.detail.includes('handoff') ||
      item.detail.includes('missing mcp') ||
      item.detail.includes('profile handoff');
    return {
      ...base,
      title: `ACP 会话 MCP 不匹配：${item.id}`,
      severity: handoffHint ? 'fixable' : 'manual',
      next_step: handoffHint ? 'new_guid' : 'cli_session',
      repair_action_ids: handoffHint ? ['deploy-seed-agents', 'repair-subagent-mcp'] : [],
    };
  }

  if (item.layer === 'probe') {
    if (item.detail === 'disabled in settings') {
      return {
        ...base,
        title: `MCP 已禁用：${item.id}`,
        severity: 'fixable',
        next_step: 'repair',
        repair_action_ids: ['ensure-wanding-settings'],
      };
    }
    if (item.detail === 'not registered in settings') {
      return {
        ...base,
        title: `MCP 未注册：${item.id}`,
        severity: 'fixable',
        next_step: 'repair',
        repair_action_ids: ['ensure-wanding-settings', 'repair-subagent-mcp'],
      };
    }
    if (item.detail.includes('missing:') || item.id === 'ccb-cli') {
      return {
        ...base,
        title: 'CCB CLI 或安装路径异常',
        severity: 'manual',
        next_step: 'manual',
        repair_action_ids: [],
      };
    }
    if (item.id.endsWith(':deep')) {
      return {
        ...base,
        title: `MCP 深探针失败：${item.id.replace(/:deep$/, '')}`,
        severity: 'manual',
        next_step: 'manual',
        repair_action_ids: [],
      };
    }
    return {
      ...base,
      title: `MCP 进程探测失败：${item.id}`,
      severity: 'manual',
      next_step: 'manual',
      repair_action_ids: [],
    };
  }

  if (item.id === 'settings.json' || item.id === 'ccb-config') {
    return {
      ...base,
      title: 'CCB 配置文件异常',
      severity: 'fixable',
      next_step: 'repair',
      repair_action_ids: ['ensure-wanding-settings'],
    };
  }

  return base;
}

export type CcbMcpHealthAutoRepairContext = {
  steps: Array<{ id: string; ok: boolean; detail: string }>;
};

function buildMinimaxPrompt(
  report: CcbMcpHealthReport,
  diagnosis: CcbMcpHealthDiagnosis,
  options?: { autoRepair?: CcbMcpHealthAutoRepairContext }
): string {
  const lines = [
    '请作为 CCB-Wanding MCP 运维助手，分析以下健康检查结果并处理剩余问题。',
    '约束：不要执行 claude mcp list；ACP 会话应使用 mcp__<server>__* 工具前缀。',
    '你可在用户授权下修改 %LOCALAPPDATA%\\CCB-Wanding\\.claude\\settings.json、agents/*.aionui.json，或运行 ccb-installer/scripts 官方脚本；勿手写 vendor/server 代码。',
    '',
    `检查时间：${report.checked_at}`,
    `失败项：${diagnosis.failed_count}`,
    `已运行探测：${report.probe ? '是（stdio + deep tools/call）' : '否'}`,
    `已运行会话探针：${report.session ? '是（ACP profile allowlist）' : '否'}`,
  ];

  if (options?.autoRepair?.steps.length) {
    lines.push('', '## 已自动执行的白名单修复（UI 触发）');
    for (const step of options.autoRepair.steps) {
      lines.push(`- [${step.ok ? 'ok' : 'fail'}] ${step.id}: ${step.detail}`);
    }
  }

  const warnItems = collectCcbMcpHealthWarnItems(report);
  if (warnItems.length) {
    lines.push('', '## 可选组件警告（不阻塞 core 4 MCP）');
    for (const item of warnItems) {
      lines.push(`- [warn] ${item.id}: ${item.detail}`);
    }
  }

  lines.push('', '## 当前仍失败的项');
  if (diagnosis.items.length === 0) {
    lines.push('- （无阻塞失败项）');
  } else {
    for (const item of diagnosis.items) {
      lines.push(`- [${item.severity}] ${item.title}: ${item.detail}`);
      if (item.repair_action_ids.length) {
        lines.push(`  关联白名单动作：${item.repair_action_ids.join(', ')}`);
      }
      if (item.next_step === 'new_guid') {
        lines.push('  建议：新开对应专家 Guid 卡片（handoff 文件有效期 300s）');
      }
      if (item.next_step === 'cli_session') {
        lines.push('  建议：运行 test-mcp-health.ps1 -Session 或 UI「会话探针」复检');
      }
    }
  }

  if (diagnosis.repair_plan.length && !options?.autoRepair) {
    lines.push('', '## 建议白名单修复（尚未运行）', diagnosis.repair_plan.join(', '));
  }

  lines.push(
    '',
    report.ok
      ? '白名单修复后健康检查已通过。若 Guid 专家卡片仍缺 MCP 工具，请判断是否需要新开专家会话。'
      : '请针对剩余失败项：1) 继续修复可自动处理的配置 2) 对 vendor/探测失败给出官方安装命令 3) Session 层失败时说明是否需新开专家 Guid 卡片。可直接在用户授权下执行文件修改或脚本。'
  );

  return lines.join('\n');
}

/** Build MiniMax Guid prompt after optional auto-repair + recheck. */
export function buildMinimaxPromptForReport(
  report: CcbMcpHealthReport,
  options?: { autoRepair?: CcbMcpHealthAutoRepairContext }
): string {
  const diagnosis = diagnoseCcbMcpHealth(report);
  const warnCount = collectCcbMcpHealthWarnItems(report).length;
  if (diagnosis.ok && !options?.autoRepair?.steps.length && warnCount === 0) {
    return '';
  }
  if (diagnosis.ok && options?.autoRepair) {
    return buildMinimaxPrompt(report, diagnosis, options);
  }
  if (diagnosis.ok && warnCount > 0) {
    return buildMinimaxPrompt(report, diagnosis, options);
  }
  return buildMinimaxPrompt(report, diagnosis, options);
}

export function diagnoseCcbMcpHealth(report: CcbMcpHealthReport): CcbMcpHealthDiagnosis {
  const failedItems = collectCcbMcpHealthFailedItems(report);

  if (failedItems.length === 0) {
    return {
      ok: true,
      failed_count: 0,
      summary: '全部通过，无需修复。',
      items: [],
      repair_plan: [],
      minimax_prompt: '',
    };
  }

  const items = failedItems.map(diagnoseItem);
  const repair_plan = orderRepairActions(items.flatMap((item) => item.repair_action_ids));
  const fixableCount = items.filter((item) => item.severity === 'fixable').length;
  const manualCount = items.filter((item) => item.severity === 'manual').length;

  const summary =
    repair_plan.length > 0
      ? `${failedItems.length} 项未通过：${fixableCount} 项可白名单修复，${manualCount} 项需人工处理。`
      : `${failedItems.length} 项未通过：需人工处理（如重装 vendor 或检查 Python 依赖）。`;

  return {
    ok: false,
    failed_count: failedItems.length,
    summary,
    items,
    repair_plan,
    minimax_prompt: buildMinimaxPrompt(
      report,
      {
        ok: false,
        failed_count: failedItems.length,
        summary,
        items,
        repair_plan,
        minimax_prompt: '',
      },
      undefined
    ),
  };
}

export function isWhitelistedRepairAction(id: string): id is CcbMcpHealthRepairActionId {
  return (CCB_MCP_HEALTH_REPAIR_ACTION_IDS as readonly string[]).includes(id);
}
