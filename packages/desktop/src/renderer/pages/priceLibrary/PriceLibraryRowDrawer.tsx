/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Typography,
} from '@arco-design/web-react';
import { Message } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import type { PriceVersionItem } from '@/common/types/priceLibrary/priceLibraryTypes';
import {
  buildPriceFieldDiff,
  buildUpsertDraftItemPayload,
  editValuesFromItem,
  type PriceLibraryEditValues,
} from '@renderer/pages/priceLibrary/priceLibraryEdit';
import {
  fetchPriceLibraryDraft,
  publishPriceLibraryDraft,
  upsertPriceLibraryItem,
} from '@renderer/pages/priceLibrary/usePriceLibrary';

export interface PriceLibraryRowDrawerProps {
  item: PriceVersionItem | null;
  visible: boolean;
  /** Defense in depth — drawer must not open for non-admin even if item is set. */
  isPriceAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
  onPublished: () => void;
}

const PriceLibraryRowDrawer: React.FC<PriceLibraryRowDrawerProps> = ({
  item,
  visible,
  isPriceAdmin,
  onClose,
  onSaved,
  onPublished,
}) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<PriceLibraryEditValues>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const open = visible && isPriceAdmin && !!item;

  useEffect(() => {
    if (item && open) {
      setValues(editValuesFromItem(item));
    }
  }, [item, open]);

  const diff = useMemo(() => (item ? buildPriceFieldDiff(item, values) : []), [item, values]);

  const setField = (field: keyof PriceLibraryEditValues, value: string | number | null) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreviewSave = () => {
    if (!item) return;
    const payload = buildUpsertDraftItemPayload(item, values);
    if (!payload) {
      Message.info(t('priceLibrary.edit.noChanges'));
      return;
    }

    Modal.confirm({
      title: t('priceLibrary.edit.confirmTitle'),
      content: (
        <div>
          <Typography.Paragraph>
            {t('priceLibrary.edit.confirmHint', { code: item.material_code })}
          </Typography.Paragraph>
          <Table
            size='small'
            pagination={false}
            rowKey='field'
            columns={[
              { title: t('priceLibrary.edit.diffField'), dataIndex: 'field' },
              {
                title: t('priceLibrary.edit.diffBefore'),
                dataIndex: 'before',
                render: (v: unknown) => (v == null || v === '' ? '—' : String(v)),
              },
              {
                title: t('priceLibrary.edit.diffAfter'),
                dataIndex: 'after',
                render: (v: unknown) => (v == null || v === '' ? '—' : String(v)),
              },
            ]}
            data={diff}
          />
        </div>
      ),
      okText: t('priceLibrary.edit.confirmWrite'),
      cancelText: t('priceLibrary.edit.cancel'),
      onOk: async () => {
        setSaving(true);
        try {
          await upsertPriceLibraryItem({
            change_type: payload.change_type,
            product_id: payload.product_id,
            material_code: payload.material_code,
            fields: payload.fields,
          });
          Message.success(t('priceLibrary.edit.writeSuccess'));
          onSaved();
          onClose();
          Modal.confirm({
            title: t('priceLibrary.edit.publishAskTitle'),
            content: t('priceLibrary.edit.publishAskContent'),
            okText: t('priceLibrary.edit.publishNow'),
            cancelText: t('priceLibrary.edit.publishLater'),
            onOk: () => handlePublish(),
          });
        } catch (err) {
          Message.error(formatWriteError(err, t));
          throw err;
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const draft = await fetchPriceLibraryDraft();
      const revision = draft.revision;
      const pending = draft.items?.length ?? 0;
      if (pending === 0) {
        Message.warning(t('priceLibrary.edit.publishEmpty'));
        return;
      }

      await new Promise<void>((resolve, reject) => {
        Modal.confirm({
          title: t('priceLibrary.edit.publishConfirmTitle'),
          content: t('priceLibrary.edit.publishConfirmContent', {
            revision,
            pending,
          }),
          okText: t('priceLibrary.edit.publishConfirm'),
          cancelText: t('priceLibrary.edit.cancel'),
          onOk: async () => {
            try {
              await publishPriceLibraryDraft({
                reason: t('priceLibrary.edit.publishReasonDefault'),
                revision,
              });
              Message.success(t('priceLibrary.edit.publishSuccess'));
              onPublished();
              onClose();
              resolve();
            } catch (err) {
              Message.error(formatWriteError(err, t));
              reject(err);
            }
          },
          onCancel: () => resolve(),
        });
      });
    } catch (err) {
      Message.error(formatWriteError(err, t));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Drawer
      width={420}
      title={
        item
          ? t('priceLibrary.edit.drawerTitle', { code: item.material_code })
          : t('priceLibrary.edit.drawerTitleFallback')
      }
      visible={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t('priceLibrary.edit.cancel')}</Button>
          <Button type='primary' loading={saving || publishing} onClick={handlePreviewSave}>
            {t('priceLibrary.edit.previewSave')}
          </Button>
        </Space>
      }
    >
      {item && (
        <Form layout='vertical' size='small'>
          <Form.Item label={t('priceLibrary.column.material')}>
            <Input value={item.material_code} disabled />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.priceA')}>
            <InputNumber
              style={{ width: '100%' }}
              value={values.price_a as number | undefined}
              onChange={(v) => setField('price_a', v ?? null)}
            />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.priceB')}>
            <InputNumber
              style={{ width: '100%' }}
              value={values.price_b as number | undefined}
              onChange={(v) => setField('price_b', v ?? null)}
            />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.priceC')}>
            <InputNumber
              style={{ width: '100%' }}
              value={values.price_c as number | undefined}
              onChange={(v) => setField('price_c', v ?? null)}
            />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.priceD')}>
            <InputNumber
              style={{ width: '100%' }}
              value={values.price_d as number | undefined}
              onChange={(v) => setField('price_d', v ?? null)}
            />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.priceE')}>
            <InputNumber
              style={{ width: '100%' }}
              value={values.price_e as number | undefined}
              onChange={(v) => setField('price_e', v ?? null)}
            />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.description')}>
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              value={(values.description as string) ?? ''}
              onChange={(v) => setField('description', v)}
            />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.descriptionCn')}>
            <Input
              value={(values.description_cn as string) ?? ''}
              onChange={(v) => setField('description_cn', v)}
            />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.supplier')}>
            <Input
              value={(values.supplier as string) ?? ''}
              onChange={(v) => setField('supplier', v)}
            />
          </Form.Item>
          <Form.Item label={t('priceLibrary.column.unit')}>
            <Input value={(values.unit as string) ?? ''} onChange={(v) => setField('unit', v)} />
          </Form.Item>
          <Typography.Text type='secondary' className='text-12px'>
            {t('priceLibrary.edit.draftHint')}
          </Typography.Text>
        </Form>
      )}
    </Drawer>
  );
};

function formatWriteError(err: unknown, t: (key: string) => string): string {
  if (isBackendHttpError(err)) {
    if (err.status === 403) {
      return t('priceLibrary.edit.forbidden');
    }
    if (err.status === 409) {
      return t('priceLibrary.edit.revisionConflict');
    }
    return err.message || t('priceLibrary.edit.writeFailed');
  }
  if (err instanceof Error) {
    return err.message;
  }
  return t('priceLibrary.edit.writeFailed');
}

export default PriceLibraryRowDrawer;
