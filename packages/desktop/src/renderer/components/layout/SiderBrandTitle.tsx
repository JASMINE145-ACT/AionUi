/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { APP_BRAND_NAME } from '@/common/config/constants'
import React from 'react'

const SiderBrandTitle: React.FC = () => (
  <div
    className='text-16px text-t-primary collapsed-hidden font-semibold truncate min-w-0'
    title={APP_BRAND_NAME}
  >
    {APP_BRAND_NAME}
  </div>
)

export default SiderBrandTitle
