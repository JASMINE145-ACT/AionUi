/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { subscribeConversationAttentionEvents } from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Shows OS notifications when a background conversation needs permission or completes a turn.
 * Trigger rules mirror sidebar unread badges (active conversation excluded).
 */
export const useConversationAttentionNotifications = (): void => {
  const { t } = useTranslation();

  useEffect(() => {
    return subscribeConversationAttentionEvents((event) => {
      const conversationLabel = event.title?.trim() || t('conversation.welcome.newConversation');

      const title =
        event.kind === 'permission'
          ? t('conversation.attention.permissionTitle', { name: conversationLabel })
          : t('conversation.attention.completionTitle', { name: conversationLabel });

      const body =
        event.kind === 'permission'
          ? event.description?.trim() ||
            t('conversation.attention.permissionBody', { defaultValue: 'Agent is waiting for your approval.' })
          : t('conversation.attention.completionBody', { defaultValue: 'Agent has finished responding.' });

      void ipcBridge.notification.show.invoke({
        title,
        body,
        conversation_id: event.conversation_id,
      });
    });
  }, [t]);
};
