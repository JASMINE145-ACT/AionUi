/**
 * Fetch org-enriched employee context from org VPS or local aioncore.
 */

import { httpGet } from '@/common/adapter/httpBridge';
import { isOrgServerConfigured, orgHttpGet } from '@/common/adapter/orgHttpBridge';
import {
  normalizeEmployeeOrgContext,
  type EmployeeOrgContext,
} from './employeeOrgContextShared';

type RawOrgContextResponse = {
  success?: boolean;
  data?: unknown;
};

const orgContextGet = orgHttpGet<RawOrgContextResponse, void>('/api/users/me/context');
const localContextGet = httpGet<RawOrgContextResponse, void>('/api/users/me/context');

export async function fetchEmployeeOrgContext(): Promise<EmployeeOrgContext | null> {
  try {
    const raw = isOrgServerConfigured()
      ? await orgContextGet.invoke()
      : await localContextGet.invoke();

    const payload = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
    return normalizeEmployeeOrgContext(payload);
  } catch (error) {
    console.warn('[fetchEmployeeOrgContext] failed:', error);
    return null;
  }
}
