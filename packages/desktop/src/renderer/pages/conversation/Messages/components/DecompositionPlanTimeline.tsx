/**
 * Visible DecompositionPlan timeline (WANd.OBSERVE.DELEGATION.002).
 * Renders approved/running plans above nested View Steps when a plan is supplied.
 */
import React, { useMemo } from 'react';
import type { DecompositionPlan } from '@/common/chat/decompositionPlan';
import type { NormalizedToolCall } from '@/common/chat/normalizeToolCall';
import { syncTurnPlanWithTools } from '@/common/chat/delegationSpawnContext';

export const DecompositionPlanTimeline: React.FC<{
  plan: DecompositionPlan;
  tools: NormalizedToolCall[];
}> = ({ plan, tools }) => {
  const linked = useMemo(() => syncTurnPlanWithTools(plan, tools), [plan, tools]);

  if (linked.status === 'cancelled') return null;

  return (
    <div className='tool-group-summary__decomp-plan' data-testid='decomposition-plan-timeline'>
      <div className='tool-group-summary__decomp-plan-title'>
        拆解计划 · {linked.status}
        {linked.confirmRequired && linked.status === 'awaiting_confirm' ? ' · 待确认' : ''}
      </div>
      <ol className='tool-group-summary__decomp-plan-steps'>
        {linked.steps.map((step, index) => (
          <li key={step.id}>
            {index + 1}. {step.title} → {step.subagentType}
            {step.parentToolUseId ? ` · run ${step.parentToolUseId.slice(0, 8)}` : ''} [{step.status}]
          </li>
        ))}
      </ol>
    </div>
  );
};

export default DecompositionPlanTimeline;
