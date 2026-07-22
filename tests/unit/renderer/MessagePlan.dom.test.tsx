/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMessagePlan } from '@/common/chat/chatLib';
import MessagePlan from '@/renderer/pages/conversation/Messages/components/MessagePlan';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { done?: number; total?: number }) => {
      if (key === 'conversation.plan.checklist.header') {
        return `${params?.done} of ${params?.total} Done`;
      }
      if (key === 'conversation.plan.messageTitle') {
        return 'To-do list';
      }
      return key;
    },
  }),
}));

const makeMessage = (): IMessagePlan =>
  ({
    id: 'plan-1',
    type: 'plan',
    content: {
      session_id: 'session-1',
      entries: [
        { content: 'Done step', status: 'completed' },
        { content: 'Active step', status: 'in_progress' },
        { content: 'Pending step', status: 'pending' },
        { content: 'Another pending', status: 'pending' },
        { content: 'Last pending', status: 'pending' },
      ],
    },
  }) as IMessagePlan;

describe('MessagePlan', () => {
  it('renders checklist header and entry states', () => {
    render(<MessagePlan message={makeMessage()} />);

    expect(screen.getByTestId('plan-checklist-header')).toHaveTextContent('1 of 5 Done');
    expect(screen.getByText('Done step')).toHaveClass('line-through');
    expect(screen.getByText('Active step')).toHaveClass('font-500');
    expect(screen.getByText('Pending step')).toBeInTheDocument();
  });
});
