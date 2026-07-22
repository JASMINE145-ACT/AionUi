/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message } from '@arco-design/web-react';
import React from 'react';

export function showWorkspaceAutoOpenToast(options: {
  hint: string;
  cta: string;
  onOpen: () => void;
}): void {
  const { hint, cta, onOpen } = options;
  Message.info({
    content: (
      <span className='text-14px'>
        {hint}{' '}
        <button
          type='button'
          className='border-0 bg-transparent p-0 text-[var(--color-primary-6)] cursor-pointer font-500 underline'
          onClick={() => {
            onOpen();
            Message.clear();
          }}
        >
          {cta}
        </button>
      </span>
    ),
    duration: 10_000,
  });
}
