/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BadgeProps } from '@arco-design/web-react';
import { Badge } from '@arco-design/web-react';
import React from 'react';
import { formatOperatorToolLabel } from '@/common/chat/operatorToolLabels';
import type { NormalizedToolCall, NormalizedToolStatus } from '@/common/chat/normalizeToolCall';

const statusToBadge = (status: NormalizedToolStatus): BadgeProps['status'] => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'error':
      return 'error';
    case 'running':
      return 'processing';
    case 'canceled':
      return 'default';
    case 'pending':
    default:
      return 'default';
  }
};

export const DelegationRunChildSteps: React.FC<{ children: NormalizedToolCall[] }> = ({ children }) => {
  if (children.length === 0) return null;

  return (
    <div className='tool-group-summary__delegation-children'>
      {children.map((child) => (
        <div key={child.key} className='flex flex-row color-#86909C gap-12px items-center tool-group-summary__nested-step'>
          <Badge
            status={statusToBadge(child.status)}
            className={child.status === 'running' ? 'badge-breathing' : ''}
          />
          <span className='flex-1 min-w-0 truncate text-13px font-medium'>{formatOperatorToolLabel(child)}</span>
        </div>
      ))}
    </div>
  );
};

export default DelegationRunChildSteps;
