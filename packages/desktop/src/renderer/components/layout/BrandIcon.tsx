/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import brandLogo from '@renderer/assets/logos/brand/app.png';
import { APP_BRAND_NAME } from '@/common/config/constants';
import classNames from 'classnames';
import React from 'react';

type BrandIconProps = {
  collapsed?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

/** WanD / Mixing sidebar brand mark — same asset as login page (`assets/logos/brand/app.png`). */
const BrandIcon: React.FC<BrandIconProps> = ({ collapsed, className, onClick }) => (
  <div
    className={classNames(
      'shrink-0 size-32px relative rd-0.5rem overflow-hidden',
      {
        '!size-24px': collapsed,
      },
      className
    )}
    onClick={onClick}
  >
    <img
      src={brandLogo}
      alt={collapsed ? APP_BRAND_NAME : ''}
      className={classNames('size-full object-cover', {
        'scale-140': !collapsed,
      })}
    />
  </div>
);

export default BrandIcon;
