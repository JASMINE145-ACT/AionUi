/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessagePlan } from '@/common/chat/chatLib';
import { Down, Right } from '@icon-park/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlanChecklist from './PlanChecklist';

const MessagePlan: React.FC<{ message: IMessagePlan }> = ({ message }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  return (
    <div data-testid='message-plan'>
      <button
        type='button'
        className='flex items-center gap-10px text-t-secondary cursor-pointer border-0 bg-transparent p-0'
        onClick={() => setExpanded((value) => !value)}
      >
        <span className='text-13px'>{t('conversation.plan.messageTitle')}</span>
        {expanded ? <Down theme='outline' size='14' /> : <Right theme='outline' size='14' />}
      </button>
      {expanded ? <PlanChecklist message={message} className='mt-8px' /> : null}
    </div>
  );
};

export default MessagePlan;
