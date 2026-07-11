import { describe, expect, it } from 'vitest';
import { CCB_DEFAULT_SESSION_AGENT_ID } from '../../../packages/desktop/src/common/config/ccbAgentCatalog';
import {
  WORK_TASK_AGENT_BRIEF_MARKER,
  WORK_TASK_UNDERSTAND_SESSION_MODE,
  appendWorkTaskAgentBriefPath,
  buildWorkTaskUnderstandPrompt,
  formatWorkTaskAgentBriefPath,
  resolveWorkTaskUnderstandDefaultAgentId,
} from '../../../packages/desktop/src/common/workTasks/workTaskOpenAgent';

const sampleTask = {
  id: 'task-abc',
  title: '[agent-acceptance] mgr assign',
  description: '请跟进库存确认',
  status: 'pending_accept' as const,
  assignee: { id: 'u1', username: 'yjc', work_task_role: 'employee' as const },
  assignee_id: 'u1',
  created_by: { id: 'u0', username: 'admin', work_task_role: 'manager' as const },
  created_by_id: 'u0',
  due_at: undefined,
};

describe('buildWorkTaskUnderstandPrompt', () => {
  it('includes task snapshot and understand-not-execute constraints', () => {
    const prompt = buildWorkTaskUnderstandPrompt({ task: sampleTask });
    expect(prompt).toContain('不是执行');
    expect(prompt).toContain('先用简体中文介绍');
    expect(prompt).toContain('不要调用 work_tasks_edit');
    expect(prompt).toContain('ID: task-abc');
    expect(prompt).toContain('标题: [agent-acceptance] mgr assign');
    expect(prompt).toContain('请跟进库存确认');
    expect(prompt).toContain('执行人: yjc');
    expect(prompt).toContain('指派人: admin');
    expect(prompt).not.toContain('附件');
  });
});

describe('appendWorkTaskAgentBriefPath', () => {
  it('appends brief path block to empty description', () => {
    const { description, appended } = appendWorkTaskAgentBriefPath(null, {
      conversationId: 'conv-12345678-ffff',
      agentId: CCB_DEFAULT_SESSION_AGENT_ID,
      agentLabel: '主入口',
      at: new Date('2026-07-11T09:30:00'),
    });
    expect(appended).toBe(true);
    expect(description).toContain(WORK_TASK_AGENT_BRIEF_MARKER);
    expect(description).toContain('主入口');
    expect(description).toContain('会话 conv-123');
  });

  it('dedupes when conversation id already present', () => {
    const first = appendWorkTaskAgentBriefPath('原说明', {
      conversationId: 'conv-aaaaaaaa',
      agentId: 'work-tasks-agent',
      agentLabel: 'work-tasks-agent',
    });
    const second = appendWorkTaskAgentBriefPath(first.description, {
      conversationId: 'conv-aaaaaaaa',
      agentId: 'work-tasks-agent',
    });
    expect(second.appended).toBe(false);
    expect(second.description).toBe(first.description);
  });
});

describe('formatWorkTaskAgentBriefPath', () => {
  it('uses short conversation id', () => {
    const line = formatWorkTaskAgentBriefPath({
      conversationId: 'abcdefghijklmnop',
      agentId: 'wande-orchestrator',
      at: new Date('2026-07-11T17:30:00'),
    });
    expect(line).toContain('会话 abcdefgh');
    expect(line).not.toContain('ijklmnop');
  });
});

describe('resolveWorkTaskUnderstandDefaultAgentId', () => {
  it('defaults to main orchestrator', () => {
    expect(resolveWorkTaskUnderstandDefaultAgentId()).toBe(CCB_DEFAULT_SESSION_AGENT_ID);
    expect(resolveWorkTaskUnderstandDefaultAgentId('  ')).toBe(CCB_DEFAULT_SESSION_AGENT_ID);
    expect(resolveWorkTaskUnderstandDefaultAgentId('work-tasks-agent')).toBe('work-tasks-agent');
  });
});

describe('WORK_TASK_UNDERSTAND_SESSION_MODE', () => {
  it('uses Claude bypassPermissions (UI: 全自动)', () => {
    expect(WORK_TASK_UNDERSTAND_SESSION_MODE).toBe('bypassPermissions');
  });
});
describe('listWorkTaskUnderstandAgentOptions', () => {
  it('puts main entry first and keeps only fleet agents', async () => {
    const { listWorkTaskUnderstandAgentOptions, workTaskUnderstandAgentLabel } = await import(
      '../../../packages/desktop/src/common/workTasks/workTaskOpenAgent'
    );
    const options = listWorkTaskUnderstandAgentOptions([
      {
        id: 'work-tasks-agent',
        name: 'work-tasks-agent',
        display_name: '任务',
        enabled: true,
        source: 'bundled',
      },
      {
        id: 'wande-orchestrator',
        name: 'wande-orchestrator',
        display_name: '',
        enabled: true,
        source: 'bundled',
      },
      {
        id: 'random-agent',
        name: 'random',
        enabled: true,
        source: 'user',
      },
    ] as never);
    expect(options[0]?.id).toBe(CCB_DEFAULT_SESSION_AGENT_ID);
    expect(options.map((a) => a.id)).toEqual(['wande-orchestrator', 'work-tasks-agent']);
    expect(workTaskUnderstandAgentLabel(options[0]!)).toBe('主入口');
  });
});
