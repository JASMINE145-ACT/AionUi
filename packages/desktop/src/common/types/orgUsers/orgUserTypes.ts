/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrgUserEmploymentStatus = 'active' | 'transferred' | 'suspended' | 'terminated';

/** Whitelist — must match AionCore `validate_capabilities`. */
export const ORG_CAPABILITY_PRICE_WRITE = 'price_library.write';
export const ORG_CAPABILITY_SUPPLIER_WRITE = 'supplier_directory.write';
export const ORG_CAPABILITY_WHITELIST = [ORG_CAPABILITY_PRICE_WRITE, ORG_CAPABILITY_SUPPLIER_WRITE] as const;
export type OrgCapability = (typeof ORG_CAPABILITY_WHITELIST)[number];

export type OrgUser = {
  id: string;
  username: string;
  work_task_role: 'manager' | 'employee';
  is_admin: boolean;
  department?: string | null;
  job_title?: string | null;
  manager_user_id?: string | null;
  employment_status: OrgUserEmploymentStatus | string;
  capabilities?: string[];
};

export type CreateOrgUserParams = {
  username: string;
  password: string;
  work_task_role?: 'manager' | 'employee';
  department?: string;
  job_title?: string;
  manager_user_id?: string;
  employment_status?: OrgUserEmploymentStatus;
  capabilities?: string[];
};

export type UpdateOrgUserParams = {
  user_id: string;
  work_task_role?: 'manager' | 'employee';
  department?: string;
  job_title?: string;
  manager_user_id?: string;
  employment_status?: OrgUserEmploymentStatus;
  capabilities?: string[];
  is_admin?: boolean;
};

export type DeleteOrgUserParams = {
  user_id: string;
};

export type ResetOrgUserPasswordParams = {
  user_id: string;
  password: string;
};

export type OrgUserDeleteResult = {
  id: string;
  username: string;
  cleared_reports_count: number;
};
