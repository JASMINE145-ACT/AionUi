/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkTask } from '@/common/types/workTasks/workTaskTypes';
import { isWorkTaskAgentCreated } from '@/common/types/workTasks/workTaskTypes';
import { Tag } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const WorkTaskSourceTag: React.FC<{ task: Pick<WorkTask, 'metadata'> }> = ({ task }) => {
  const { t } = useTranslation();
  if (!isWorkTaskAgentCreated(task)) return null;
  return (
    <Tag size='small' color='purple'>
      {t('workTasks.source.agent')}
    </Tag>
  );
};

export default WorkTaskSourceTag;
