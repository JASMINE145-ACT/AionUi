/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import EmployeeProfileModalContent from '@/renderer/components/settings/SettingsModal/contents/EmployeeProfileModalContent';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const EmployeeProfileSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <EmployeeProfileModalContent />
    </SettingsPageWrapper>
  );
};

export default EmployeeProfileSettings;
