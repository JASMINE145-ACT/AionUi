/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Message,
  Radio,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconRefresh } from '@arco-design/web-react/icon';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { isOrgServerConfigured } from '@/common/adapter/orgHttpBridge';
import type { SupplierRow } from '@/common/types/supplierDirectory/supplierDirectoryTypes';
import {
  displayOrDash,
  formatDistanceKm,
  parseSupplierLocations,
  parseSupplierProductGroups,
} from '@/common/types/supplierDirectory/supplierDirectoryTypes';
import { useOrgAuth } from '@renderer/hooks/context/OrgAuthContext';
import {
  upsertSupplier,
  upsertVehicle,
  useLogisticsVehicles,
  useSupplierMatch,
  useSuppliersList,
} from '@renderer/pages/suppliers/useSupplierDirectory';
import type { LogisticsVehicleRow } from '@/common/types/supplierDirectory/supplierDirectoryTypes';

type Mode = 'browse' | 'match' | 'vehicles';

/** Keep dense ops table headers on one line (ui-ux-pro-max: alignment + readable measure). */
const TABLE_HEADER_NOWRAP = { headerCellStyle: { whiteSpace: 'nowrap' as const } };

const SuppliersPage: React.FC = () => {
  const { configured, orgUser } = useOrgAuth();
  const [mode, setMode] = useState<Mode>('browse');
  const [browseQ, setBrowseQ] = useState('');
  const [matchQ, setMatchQ] = useState('');
  const [matchSubmitted, setMatchSubmitted] = useState('');
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<LogisticsVehicleRow | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
    mutate: mutateList,
  } = useSuppliersList(browseQ.trim() || undefined);
  const {
    data: matchData,
    error: matchError,
    isLoading: matchLoading,
    mutate: mutateMatch,
  } = useSupplierMatch(matchSubmitted, mode === 'match');
  const {
    data: vehicleData,
    error: vehicleError,
    isLoading: vehicleLoading,
    mutate: mutateVehicles,
  } = useLogisticsVehicles();

  const canWrite = Boolean(orgUser?.username);

  const browseColumns = useMemo(
    () => [
      { title: '工厂', dataIndex: 'name_zh', width: 120, ...TABLE_HEADER_NOWRAP },
      { title: '品类', dataIndex: 'category', width: 100, ellipsis: true, ...TABLE_HEADER_NOWRAP },
      {
        title: '距离',
        dataIndex: 'distance_km',
        width: 88,
        ...TABLE_HEADER_NOWRAP,
        bodyCellStyle: { whiteSpace: 'nowrap' },
        render: (v: number | null) => formatDistanceKm(v),
      },
      {
        title: '产品',
        dataIndex: 'products_summary',
        ellipsis: true,
        ...TABLE_HEADER_NOWRAP,
        render: (_: unknown, row: SupplierRow) => row.products_summary || displayOrDash(row.products_text),
      },
      { title: '地址', dataIndex: 'address', ellipsis: true, width: 200, ...TABLE_HEADER_NOWRAP },
      { title: '联系人', dataIndex: 'contact', width: 88, ellipsis: true, ...TABLE_HEADER_NOWRAP },
      { title: '电话', dataIndex: 'phone', width: 120, ellipsis: true, ...TABLE_HEADER_NOWRAP },
      {
        title: '等级',
        dataIndex: 'grade',
        width: 64,
        ...TABLE_HEADER_NOWRAP,
        bodyCellStyle: { whiteSpace: 'nowrap' },
        render: (v: string) => displayOrDash(v),
      },
      {
        title: '操作',
        width: 80,
        fixed: 'right' as const,
        ...TABLE_HEADER_NOWRAP,
        bodyCellStyle: { whiteSpace: 'nowrap' },
        render: (_: unknown, row: SupplierRow) => (
          <Button type='text' size='mini' onClick={() => setEditing(row)}>
            详情
          </Button>
        ),
      },
    ],
    []
  );

  const matchColumns = useMemo(
    () => [
      { title: '工厂', dataIndex: 'name_zh', width: 120, ...TABLE_HEADER_NOWRAP },
      { title: '分', dataIndex: 'score', width: 56, ...TABLE_HEADER_NOWRAP },
      {
        title: '距离',
        dataIndex: 'distance_km',
        width: 88,
        ...TABLE_HEADER_NOWRAP,
        bodyCellStyle: { whiteSpace: 'nowrap' },
        render: (v: number | null | undefined) => formatDistanceKm(v ?? null),
      },
      { title: '命中', dataIndex: 'snippet', ellipsis: true, ...TABLE_HEADER_NOWRAP },
      { title: '品类', dataIndex: 'category', width: 100, ellipsis: true, ...TABLE_HEADER_NOWRAP },
      { title: '地址', dataIndex: 'address', ellipsis: true, ...TABLE_HEADER_NOWRAP },
    ],
    []
  );

  const vehicleColumns = useMemo(
    () => [
      { title: 'No', dataIndex: 'sort_no', width: 56, ...TABLE_HEADER_NOWRAP },
      { title: '车型', dataIndex: 'name_zh', width: 120, ...TABLE_HEADER_NOWRAP },
      { title: 'ID', dataIndex: 'name_id', width: 120, ellipsis: true, ...TABLE_HEADER_NOWRAP },
      { title: '载重', dataIndex: 'load_zh', width: 100, ...TABLE_HEADER_NOWRAP },
      { title: '尺寸', dataIndex: 'size_zh', ellipsis: true, ...TABLE_HEADER_NOWRAP },
      { title: '用途', dataIndex: 'use_zh', ellipsis: true, ...TABLE_HEADER_NOWRAP },
      {
        title: '操作',
        width: 80,
        fixed: 'right' as const,
        ...TABLE_HEADER_NOWRAP,
        bodyCellStyle: { whiteSpace: 'nowrap' },
        render: (_: unknown, row: LogisticsVehicleRow) => (
          <Button type='text' size='mini' onClick={() => setEditingVehicle(row)}>
            编辑
          </Button>
        ),
      },
    ],
    []
  );

  const orgOk = configured && isOrgServerConfigured();

  const saveSupplier = async (values: Record<string, string>) => {
    if (!editing) return;
    setSaving(true);
    try {
      await upsertSupplier({
        name_zh: values.name_zh || editing.name_zh,
        code: values.code ?? editing.code,
        category: values.category ?? editing.category,
        products_text: values.products_text ?? editing.products_text,
        address: values.address ?? editing.address,
        contact: values.contact ?? editing.contact,
        phone: values.phone ?? editing.phone,
        whatsapp: values.whatsapp ?? editing.whatsapp,
        email: values.email ?? editing.email,
        notes: values.notes ?? editing.notes,
        grade: values.grade ?? editing.grade,
        spec: values.spec ?? editing.spec,
        tech_params: values.tech_params ?? editing.tech_params,
        material: values.material ?? editing.material,
        price_note: values.price_note ?? editing.price_note,
        moq: values.moq ?? editing.moq,
        lead_days: values.lead_days ?? editing.lead_days,
        qualification: values.qualification ?? editing.qualification,
        distance_km: editing.distance_km,
        products_json: editing.products_json,
        locations_json: editing.locations_json,
      });
      Message.success('已保存');
      setEditing(null);
      await mutateList();
    } catch (err) {
      const msg = isBackendHttpError(err) ? err.message : String(err);
      Message.error(msg.includes('403') || msg.includes('Forbidden') ? '无写权限（需名录管理员白名单）' : msg);
    } finally {
      setSaving(false);
    }
  };

  const saveVehicle = async (values: Record<string, string>) => {
    if (!editingVehicle) return;
    setSaving(true);
    try {
      await upsertVehicle({
        seed_key: editingVehicle.seed_key,
        sort_no: editingVehicle.sort_no,
        name_zh: values.name_zh ?? editingVehicle.name_zh,
        name_id: values.name_id ?? editingVehicle.name_id,
        load_zh: values.load_zh ?? editingVehicle.load_zh,
        load_id: values.load_id ?? editingVehicle.load_id,
        size_zh: values.size_zh ?? editingVehicle.size_zh,
        size_id: values.size_id ?? editingVehicle.size_id,
        use_zh: values.use_zh ?? editingVehicle.use_zh,
        use_id: values.use_id ?? editingVehicle.use_id,
      });
      Message.success('已保存');
      setEditingVehicle(null);
      await mutateVehicles();
    } catch (err) {
      const msg = isBackendHttpError(err) ? err.message : String(err);
      Message.error(msg.includes('403') || msg.includes('Forbidden') ? '无写权限（需名录管理员白名单）' : msg);
    } finally {
      setSaving(false);
    }
  };

  const productGroups = editing ? parseSupplierProductGroups(editing) : [];
  const locations = editing ? parseSupplierLocations(editing) : [];

  const productDetailRows = useMemo(() => {
    const rows: { key: string; category: string; name: string }[] = [];
    for (const grp of productGroups) {
      for (const name of grp.products) {
        rows.push({ key: `${grp.category}-${name}`, category: grp.category, name });
      }
    }
    if (rows.length === 0 && editing?.products_text && !editing.products_text.startsWith(';;')) {
      for (const name of editing.products_text.split(/[、，；]/).map((s) => s.trim()).filter(Boolean)) {
        rows.push({ key: name, category: '', name });
      }
    }
    return rows;
  }, [productGroups, editing]);

  if (!orgOk) {
    return (
      <div className='p-24px'>
        <Alert type='warning' content='未配置组织服务器。请设置 ORG_SERVER_URL 后使用供应商名录。' />
      </div>
    );
  }

  return (
    <div className='p-16px flex flex-col h-full min-h-0 overflow-hidden'>
      <div className='mb-10px flex items-center justify-between gap-12px flex-shrink-0 min-w-0'>
        <Space size='small' align='center' className='min-w-0 flex-1'>
          <Typography.Title heading={5} style={{ margin: 0, flexShrink: 0 }}>
            供应商名录
          </Typography.Title>
          {orgUser?.username ? (
            <Tag color='green' size='small' className='max-w-[200px] truncate'>
              账号：{orgUser.username}
            </Tag>
          ) : null}
        </Space>
        <Button
          size='small'
          className='flex-shrink-0'
          icon={<IconRefresh />}
          loading={listLoading || matchLoading || vehicleLoading}
          onClick={() => {
            void mutateList();
            void mutateMatch();
            void mutateVehicles();
          }}
        >
          刷新
        </Button>
      </div>

      <Radio.Group
        className='flex-shrink-0'
        type='button'
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        options={[
          { label: '供应商浏览', value: 'browse' },
          { label: '产品匹配', value: 'match' },
          { label: '运输车辆', value: 'vehicles' },
        ]}
      />

      {mode === 'browse' ? (
        <>
          <Input.Search
            allowClear
            placeholder='搜索工厂名 / 产品 / 地址（如：双林）'
            value={browseQ}
            onChange={setBrowseQ}
            style={{ maxWidth: 480 }}
          />
          {listError ? (
            <Alert
              type='error'
              content={
                isBackendHttpError(listError)
                  ? listError.message
                  : '加载供应商失败（请确认 aioncore 已部署 migration 023）'
              }
            />
          ) : null}
          <Spin loading={listLoading} className='flex-1 min-h-0'>
            <Table
              rowKey='id'
              columns={browseColumns}
              data={listData?.items ?? []}
              pagination={{ pageSize: 20 }}
              scroll={{ x: 1180, y: 'calc(100vh - 280px)' }}
            />
          </Spin>
        </>
      ) : null}

      {mode === 'match' ? (
        <>
          <Space>
            <Input
              allowClear
              placeholder='产品关键词（如：土工布）'
              value={matchQ}
              onChange={setMatchQ}
              style={{ width: 360 }}
              onPressEnter={() => setMatchSubmitted(matchQ.trim())}
            />
            <Button type='primary' onClick={() => setMatchSubmitted(matchQ.trim())}>
              匹配
            </Button>
          </Space>
          {matchError ? (
            <Alert
              type='error'
              content={isBackendHttpError(matchError) ? matchError.message : '匹配失败'}
            />
          ) : null}
          <Spin loading={matchLoading} className='flex-1 min-h-0'>
            <Table
              rowKey='id'
              columns={matchColumns}
              data={matchData?.items ?? []}
              pagination={false}
              scroll={{ y: 'calc(100vh - 280px)' }}
              noDataElement={matchSubmitted ? '无匹配结果' : '输入产品关键词后匹配'}
            />
          </Spin>
        </>
      ) : null}

      {mode === 'vehicles' ? (
        <>
          {vehicleError ? (
            <Alert
              type='error'
              content={isBackendHttpError(vehicleError) ? vehicleError.message : '加载车辆失败'}
            />
          ) : null}
          <Spin loading={vehicleLoading} className='flex-1 min-h-0'>
            <Table
              rowKey='id'
              columns={vehicleColumns}
              data={vehicleData?.items ?? []}
              pagination={false}
              scroll={{ y: 'calc(100vh - 260px)' }}
            />
          </Spin>
        </>
      ) : null}

      <Drawer
        width={560}
        title={editing ? `工厂 · ${editing.name_zh}` : '工厂'}
        visible={Boolean(editing)}
        onCancel={() => setEditing(null)}
        footer={null}
      >
        {editing ? (
          <>
            {locations.length > 0 ? (
              <div className='mb-16px'>
                <Typography.Text bold>地址 / 距离</Typography.Text>
                <Table
                  className='mt-8px'
                  size='mini'
                  pagination={false}
                  rowKey={(r) => `${r.type}-${r.address}`}
                  columns={[
                    { title: '类型', dataIndex: 'type', width: 80 },
                    { title: '地址', dataIndex: 'address', ellipsis: true },
                    {
                      title: '距离',
                      width: 72,
                      render: (_: unknown, r) => formatDistanceKm(r.distance_km ?? null),
                    },
                    { title: '电话', dataIndex: 'phone', width: 120, ellipsis: true },
                  ]}
                  data={locations}
                />
              </div>
            ) : null}

            {productDetailRows.length > 0 ? (
              <div className='mb-16px'>
                <Typography.Text bold>主营产品</Typography.Text>
                <Table
                  className='mt-8px'
                  size='mini'
                  pagination={false}
                  rowKey='key'
                  columns={[
                    { title: '大类', dataIndex: 'category', width: 100, ellipsis: true },
                    { title: '产品名称', dataIndex: 'name', ellipsis: true },
                    {
                      title: '规格',
                      width: 72,
                      render: () => displayOrDash(editing.spec),
                    },
                    {
                      title: '材质',
                      width: 72,
                      render: () => displayOrDash(editing.material),
                    },
                    {
                      title: '单价',
                      width: 72,
                      render: () => displayOrDash(editing.price_note),
                    },
                    { title: 'MOQ', width: 56, render: () => displayOrDash(editing.moq) },
                    { title: '交期', width: 56, render: () => displayOrDash(editing.lead_days) },
                  ]}
                  data={productDetailRows}
                  scroll={{ y: 200 }}
                />
              </div>
            ) : null}

            <Form
              layout='vertical'
              initialValues={editing}
              onSubmit={(v) => void saveSupplier(v as Record<string, string>)}
            >
              <Form.Item label='工厂全称' field='name_zh' disabled>
                <Input />
              </Form.Item>
              <Form.Item label='编码' field='code'>
                <Input />
              </Form.Item>
              <Form.Item label='品类' field='category'>
                <Input />
              </Form.Item>
              <Form.Item label='距离(km)'>
                <Input disabled value={formatDistanceKm(editing.distance_km)} />
              </Form.Item>
              <Form.Item label='地址' field='address'>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
              </Form.Item>
              <Form.Item label='联系人' field='contact'>
                <Input />
              </Form.Item>
              <Form.Item label='电话' field='phone'>
                <Input />
              </Form.Item>
              <Form.Item label='WhatsApp' field='whatsapp'>
                <Input />
              </Form.Item>
              <Form.Item label='邮箱' field='email'>
                <Input />
              </Form.Item>
              <Form.Item label='资质' field='qualification'>
                <Input />
              </Form.Item>
              <Form.Item label='等级' field='grade'>
                <Input />
              </Form.Item>
              <Form.Item label='规格(行级)' field='spec'>
                <Input />
              </Form.Item>
              <Form.Item label='技术参数(行级)' field='tech_params'>
                <Input />
              </Form.Item>
              <Form.Item label='材质(行级)' field='material'>
                <Input />
              </Form.Item>
              <Form.Item label='单价(行级)' field='price_note'>
                <Input />
              </Form.Item>
              <Form.Item label='MOQ(行级)' field='moq'>
                <Input />
              </Form.Item>
              <Form.Item label='交期(行级)' field='lead_days'>
                <Input />
              </Form.Item>
              <Form.Item label='备注' field='notes'>
                <Input />
              </Form.Item>
              <Button type='primary' htmlType='submit' loading={saving} disabled={!canWrite}>
                保存
              </Button>
            </Form>
          </>
        ) : null}
      </Drawer>

      <Drawer
        width={480}
        title={editingVehicle ? `车辆 · ${editingVehicle.name_zh}` : '车辆'}
        visible={Boolean(editingVehicle)}
        onCancel={() => setEditingVehicle(null)}
        footer={null}
      >
        {editingVehicle ? (
          <Form
            layout='vertical'
            initialValues={editingVehicle}
            onSubmit={(v) => void saveVehicle(v as Record<string, string>)}
          >
            <Form.Item label='车型（中）' field='name_zh'>
              <Input />
            </Form.Item>
            <Form.Item label='车型（ID）' field='name_id'>
              <Input />
            </Form.Item>
            <Form.Item label='载重' field='load_zh'>
              <Input />
            </Form.Item>
            <Form.Item label='尺寸' field='size_zh'>
              <Input />
            </Form.Item>
            <Form.Item label='用途' field='use_zh'>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
            </Form.Item>
            <Button type='primary' htmlType='submit' loading={saving} disabled={!canWrite}>
              保存
            </Button>
          </Form>
        ) : null}
      </Drawer>
    </div>
  );
};

export default SuppliersPage;
