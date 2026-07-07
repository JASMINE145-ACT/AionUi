/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Renderer-safe employee profile types and markdown formatter.
 */

export type EmployeeProfile = {
  displayName?: string;
  /** Optional daily address name; defaults from displayName when empty. */
  addressName?: string;
  department?: string;
  jobTitle?: string;
  employeeId?: string;
  email?: string;
  phone?: string;
  notes?: string;
  updatedAt?: string;
};

export const CCB_EMPLOYEE_PROFILE_FILE = 'employee-profile.json' as const;

const MAX_NOTES_LENGTH = 500;
const MAX_ADDRESS_NAME_LENGTH = 20;

function trimField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** True when name is mostly CJK (Chinese/Japanese/Korean) characters. */
export function isMostlyCjkName(name: string): boolean {
  const cjk = name.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length ?? 0;
  return cjk > 0 && cjk >= name.replace(/\s/g, '').length * 0.5;
}

/** Derive daily address name: explicit addressName → CJK last 2 chars → displayName. */
export function derivePreferredAddressName(profile: EmployeeProfile): string | undefined {
  const explicit = trimField(profile.addressName);
  if (explicit) return explicit.slice(0, MAX_ADDRESS_NAME_LENGTH);

  const displayName = trimField(profile.displayName);
  if (!displayName) return undefined;

  const compact = displayName.replace(/\s/g, '');
  if (isMostlyCjkName(compact) && compact.length >= 2) {
    return compact.slice(-2);
  }

  return displayName.slice(0, MAX_ADDRESS_NAME_LENGTH);
}

export function normalizeEmployeeProfile(input: EmployeeProfile | null | undefined): EmployeeProfile | null {
  if (!input || typeof input !== 'object') return null;

  const profile: EmployeeProfile = {
    ...(trimField(input.displayName) ? { displayName: trimField(input.displayName) } : {}),
    ...(trimField(input.addressName)
      ? { addressName: trimField(input.addressName)!.slice(0, MAX_ADDRESS_NAME_LENGTH) }
      : {}),
    ...(trimField(input.department) ? { department: trimField(input.department) } : {}),
    ...(trimField(input.jobTitle) ? { jobTitle: trimField(input.jobTitle) } : {}),
    ...(trimField(input.employeeId) ? { employeeId: trimField(input.employeeId) } : {}),
    ...(trimField(input.email) ? { email: trimField(input.email) } : {}),
    ...(trimField(input.phone) ? { phone: trimField(input.phone) } : {}),
    ...(trimField(input.notes)
      ? { notes: trimField(input.notes)!.slice(0, MAX_NOTES_LENGTH) }
      : {}),
    ...(trimField(input.updatedAt) ? { updatedAt: trimField(input.updatedAt) } : {}),
  };

  return isEmployeeProfileEmpty(profile) ? null : profile;
}

export function isEmployeeProfileEmpty(profile: EmployeeProfile | null | undefined): boolean {
  if (!profile) return true;
  return !(
    profile.displayName ||
    profile.addressName ||
    profile.department ||
    profile.jobTitle ||
    profile.employeeId ||
    profile.email ||
    profile.phone ||
    profile.notes
  );
}

export function formatEmployeeProfileClaudeMd(profile: EmployeeProfile | null | undefined): string | undefined {
  const normalized = normalizeEmployeeProfile(profile);
  if (!normalized) return undefined;

  const addressName = derivePreferredAddressName(normalized);

  const lines = ['# 当前用户 / Current user', ''];

  if (addressName) {
    lines.push('## 对话称呼 / Addressing the user', '');
    lines.push(`- **日常称呼 / Preferred address:** ${addressName}`);
    if (normalized.displayName && normalized.displayName !== addressName) {
      lines.push(`- **登记姓名 / Registered name:** ${normalized.displayName}`);
    }
    lines.push(
      `- 在问候、确认、任务完成与交接时，**优先用「${addressName}」称呼用户**，例如：「好的${addressName}，…」「${addressName}，还有什么需要帮忙的吗？」`,
      '- 每轮回复 1–2 次即可，自然即可；不要机械地在每句话末尾重复称呼。',
      '- 用户**未**询问身份/个人信息时，**不要**主动列出下方完整登记表；仅在用户明确问「我是谁/我的信息/个人信息」时结构化回答。',
      '- 勿向第三方泄露未必要的个人信息。',
      ''
    );
  }

  lines.push('## 登记信息 / Registered profile', '');
  if (normalized.displayName) lines.push(`- **姓名 / Name:** ${normalized.displayName}`);
  if (normalized.department) lines.push(`- **部门 / Department:** ${normalized.department}`);
  if (normalized.jobTitle) lines.push(`- **职位 / Title:** ${normalized.jobTitle}`);
  if (normalized.employeeId) lines.push(`- **工号 / Employee ID:** ${normalized.employeeId}`);
  if (normalized.email) lines.push(`- **邮箱 / Email:** ${normalized.email}`);
  if (normalized.phone) lines.push(`- **电话 / Phone:** ${normalized.phone}`);
  if (normalized.notes) lines.push(`- **补充 / Notes:** ${normalized.notes}`);

  return lines.join('\n');
}

export function mergeEmployeeProfileIntoUserContext(
  base: { [key: string]: string } | undefined,
  profile: EmployeeProfile | null | undefined,
): { [key: string]: string } | undefined {
  const employeeBlock = formatEmployeeProfileClaudeMd(profile);
  if (!employeeBlock) return base;

  if (!base) {
    return { claudeMd: employeeBlock };
  }

  const mergedClaudeMd = base.claudeMd ? `${base.claudeMd}\n\n${employeeBlock}` : employeeBlock;
  return { ...base, claudeMd: mergedClaudeMd };
}
