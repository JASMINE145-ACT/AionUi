/**
 * WANd.ROUTING.ASSIGNMENT.004 + WANd.OBSERVE.DELEGATION.002
 * Decomposition plan (visible steps) ↔ DelegationRun link helpers.
 */

import type { DelegationRun } from './delegationRun';

export type DecompositionPlanStatus = 'draft' | 'awaiting_confirm' | 'approved' | 'cancelled' | 'running' | 'done';

export type DecompositionPlanStepStatus = 'pending' | 'running' | 'done' | 'blocked' | 'skipped';

export type DecompositionPlanStep = {
  /** Stable id written into Brief Inputs as plan_step_id */
  id: string
  title: string
  subagentType: string
  status: DecompositionPlanStepStatus
  /** Linked Agent tool_call_id when Execution started */
  parentToolUseId?: string
}

export type DecompositionPlan = {
  id: string
  /** Requires hard user confirm before any Agent() */
  confirmRequired: true
  status: DecompositionPlanStatus
  steps: DecompositionPlanStep[]
}

export function createDecompositionPlan(
  steps: Array<{ title: string; subagentType: string }>,
  options?: { id?: string },
): DecompositionPlan {
  const id = options?.id ?? `plan_${Date.now()}`
  return {
    id,
    confirmRequired: true,
    status: 'awaiting_confirm',
    steps: steps.map((s, i) => ({
      id: `${id}_s${i + 1}`,
      title: s.title,
      subagentType: s.subagentType,
      status: 'pending',
    })),
  }
}

export function approveDecompositionPlan(plan: DecompositionPlan): DecompositionPlan {
  if (plan.status === 'cancelled') return plan
  return { ...plan, status: 'approved' }
}

export function cancelDecompositionPlan(plan: DecompositionPlan): DecompositionPlan {
  return { ...plan, status: 'cancelled' }
}

/** Link a finished/running DelegationRun onto the first matching pending/same-agent step. */
export function linkDelegationRunToPlan(
  plan: DecompositionPlan,
  run: DelegationRun,
): DecompositionPlan {
  const steps = [...plan.steps]
  const idx = steps.findIndex(
    (s) =>
      !s.parentToolUseId &&
      s.subagentType === run.subagentType &&
      (s.status === 'pending' || s.status === 'running'),
  )
  if (idx < 0) return plan

  const step = steps[idx]!
  const stepStatus: DecompositionPlanStepStatus =
    run.status === 'running' ? 'running' : run.status === 'blocked' ? 'blocked' : 'done'

  steps[idx] = {
    ...step,
    parentToolUseId: run.parentToolUseId,
    status: stepStatus,
  }

  const allDone = steps.every((s) => s.status === 'done' || s.status === 'skipped')
  const anyActive = steps.some((s) => s.status === 'running' || s.status === 'blocked')

  let status: DecompositionPlanStatus = plan.status
  if (plan.status === 'approved' || plan.status === 'running' || plan.status === 'done') {
    if (allDone) status = 'done'
    else if (anyActive || steps.some((s) => s.parentToolUseId)) status = 'running'
  }

  return { ...plan, steps, status }
}

/** Apply all DelegationRuns in turn order onto an approved plan (OBSERVE.DELEGATION.002). */
export function syncPlanWithDelegationRuns(
  plan: DecompositionPlan,
  runs: DelegationRun[],
): DecompositionPlan {
  return runs.reduce((acc, run) => linkDelegationRunToPlan(acc, run), plan)
}

/** Derive a display plan from multiple DelegationRuns when no authored plan is supplied. */
export function derivePlanFromDelegationRuns(runs: DelegationRun[]): DecompositionPlan | undefined {
  if (runs.length < 2) return undefined

  const steps = runs.map((run, index) => {
    const stepStatus: DecompositionPlanStepStatus =
      run.status === 'running' ? 'running' : run.status === 'blocked' ? 'blocked' : 'done'
    return {
      id: `derived_${run.parentToolUseId}_s${index + 1}`,
      title: run.displayLabel || run.subagentType,
      subagentType: run.subagentType,
      status: stepStatus,
      parentToolUseId: run.parentToolUseId,
    }
  })

  const allDone = steps.every((s) => s.status === 'done')
  return {
    id: `derived_${runs[0]!.parentToolUseId}`,
    confirmRequired: true,
    status: allDone ? 'done' : 'running',
    steps,
  }
}


export function findPlanStepForDelegationRun(
  plan: DecompositionPlan,
  parentToolUseId: string,
): DecompositionPlanStep | undefined {
  return plan.steps.find((s) => s.parentToolUseId === parentToolUseId)
}

/** Operator-facing markdown for chat / plan-gate messages. */
export function formatDecompositionPlanMarkdown(plan: DecompositionPlan): string {
  const lines = [
    `拆解计划 \`${plan.id}\`（需确认后执行）`,
    '',
    ...plan.steps.map((s, i) => `${i + 1}. ${s.title} → \`${s.subagentType}\` [${s.status}]`),
    '',
    plan.status === 'awaiting_confirm'
      ? '请回复「确认」开始逐步执行，或「取消」中止。'
      : `状态：${plan.status}`,
  ]
  return lines.join('\n')
}
