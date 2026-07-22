import { describe, expect, it } from 'vitest'
import {
  approveDecompositionPlan,
  cancelDecompositionPlan,
  createDecompositionPlan,
  findPlanStepForDelegationRun,
  formatDecompositionPlanMarkdown,
  linkDelegationRunToPlan,
  syncPlanWithDelegationRuns,
  derivePlanFromDelegationRuns,
} from '@/common/chat/decompositionPlan'
import type { DelegationRun } from '@/common/chat/delegationRun'
import type { NormalizedToolCall } from '@/common/chat/normalizeToolCall'

const fakeAgentTool = (id: string, subagentType: string): NormalizedToolCall =>
  ({
    toolCallId: id,
    name: 'Agent',
    status: 'completed',
    rawInput: { subagent_type: subagentType },
  }) as NormalizedToolCall

const fakeRun = (parentToolUseId: string, subagentType: string, status: DelegationRun['status'] = 'done'): DelegationRun => ({
  parentToolUseId,
  subagentType,
  displayLabel: subagentType,
  childToolCount: 1,
  completedChildCount: 1,
  status,
  children: [],
  agentTool: fakeAgentTool(parentToolUseId, subagentType),
})

describe('decompositionPlan WANd.ROUTING.ASSIGNMENT.004 / OBSERVE.DELEGATION.002', () => {
  it('creates awaiting_confirm plan with hard confirmRequired', () => {
    const plan = createDecompositionPlan([
      { title: '查价', subagentType: 'quotation-agent' },
      { title: '做Word', subagentType: 'word-creator' },
    ])
    expect(plan.confirmRequired).toBe(true)
    expect(plan.status).toBe('awaiting_confirm')
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[0]!.id).toContain('_s1')
  })

  it('approve then link DelegationRuns in order', () => {
    let plan = createDecompositionPlan([
      { title: '查价', subagentType: 'quotation-agent' },
      { title: '做Word', subagentType: 'word-creator' },
    ])
    plan = approveDecompositionPlan(plan)
    expect(plan.status).toBe('approved')

    plan = linkDelegationRunToPlan(plan, fakeRun('tc-1', 'quotation-agent', 'done'))
    expect(plan.steps[0]!.parentToolUseId).toBe('tc-1')
    expect(plan.steps[0]!.status).toBe('done')
    expect(findPlanStepForDelegationRun(plan, 'tc-1')?.title).toBe('查价')

    plan = linkDelegationRunToPlan(plan, fakeRun('tc-2', 'word-creator', 'done'))
    expect(plan.steps[1]!.parentToolUseId).toBe('tc-2')
    expect(plan.status).toBe('done')
  })

  it('cancel blocks approve semantic (stays cancelled)', () => {
    let plan = createDecompositionPlan([{ title: '查价', subagentType: 'quotation-agent' }])
    plan = cancelDecompositionPlan(plan)
    plan = approveDecompositionPlan(plan)
    expect(plan.status).toBe('cancelled')
  })

  it('formats plan markdown for confirm gate', () => {
    const plan = createDecompositionPlan([{ title: '查价', subagentType: 'quotation-agent' }], { id: 'plan_demo' })
    const md = formatDecompositionPlanMarkdown(plan)
    expect(md).toContain('拆解计划')
    expect(md).toContain('quotation-agent')
    expect(md).toContain('确认')
  })

  it('syncPlanWithDelegationRuns links multiple runs', () => {
    let plan = approveDecompositionPlan(
      createDecompositionPlan([
        { title: '查价', subagentType: 'quotation-agent' },
        { title: 'Word', subagentType: 'word-creator' },
      ]),
    )
    plan = syncPlanWithDelegationRuns(plan, [
      fakeRun('tc-1', 'quotation-agent', 'done'),
      fakeRun('tc-2', 'word-creator', 'done'),
    ])
    expect(plan.steps[0]!.parentToolUseId).toBe('tc-1')
    expect(plan.steps[1]!.parentToolUseId).toBe('tc-2')
    expect(plan.status).toBe('done')
  })

  it('derivePlanFromDelegationRuns only for multi-run turns', () => {
    expect(derivePlanFromDelegationRuns([fakeRun('tc-1', 'quotation-agent')])).toBeUndefined()
    const derived = derivePlanFromDelegationRuns([
      fakeRun('tc-1', 'quotation-agent', 'done'),
      fakeRun('tc-2', 'word-creator', 'done'),
    ])
    expect(derived?.steps).toHaveLength(2)
    expect(derived?.status).toBe('done')
    expect(derived?.steps[0]!.parentToolUseId).toBe('tc-1')
  })
})
