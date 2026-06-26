/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Tag } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import type { WorkTaskStatus } from '@/common/types/workTasks/workTaskTypes';
import { WORK_TASK_STATUS_I18N_KEY } from '@/common/types/workTasks/workTaskTypes';

const STATUS_COLOR: Record<WorkTaskStatus, string> = {
  pending_accept: 'orangered',
  accepted: 'arcoblue',
  completed: 'green',
  incomplete: 'red',
  deferred: 'gray',
};

const WorkTaskStatusTag: React.FC<{ status: WorkTaskStatus }> = ({ status }) => {
  const { t } = useTranslation();
  return <Tag color={STATUS_COLOR[status]}>{t(WORK_TASK_STATUS_I18N_KEY[status])}</Tag>;
};

export default WorkTaskStatusTag;
