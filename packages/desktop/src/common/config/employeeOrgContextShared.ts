/**
 * Org-sourced employee identity (EIL slice — server authority).
 */

export type EmployeeOrgContext = {
  userId: string;
  username: string;
  displayName: string;
  department?: string;
  managerUserId?: string;
  managerUsername?: string;
  jobTitle?: string;
  workTaskRole: string;
  employmentStatus: string;
  dataScopeMax: string;
};

/** Client-editable supplemental fields only (Settings). */
export type EmployeeClientProfile = {
  addressName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  updatedAt?: string;
};

/** Handoff file written for CCB ACP session/new + runAgent merge. */
export type EmployeeProfileHandoff = {
  org?: EmployeeOrgContext | null;
  client?: EmployeeClientProfile | null;
  cleared_at?: string;
  updatedAt?: string;
};

function trimField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizeEmployeeOrgContext(input: unknown): EmployeeOrgContext | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const userId = trimField(raw.user_id ?? raw.userId);
  const username = trimField(raw.username);
  if (!userId || !username) return null;

  return {
    userId,
    username,
    displayName: trimField(raw.display_name ?? raw.displayName) ?? username,
    ...(trimField(raw.department) ? { department: trimField(raw.department) } : {}),
    ...(trimField(raw.manager_user_id ?? raw.managerUserId)
      ? { managerUserId: trimField(raw.manager_user_id ?? raw.managerUserId) }
      : {}),
    ...(trimField(raw.manager_username ?? raw.managerUsername)
      ? { managerUsername: trimField(raw.manager_username ?? raw.managerUsername) }
      : {}),
    ...(trimField(raw.job_title ?? raw.jobTitle)
      ? { jobTitle: trimField(raw.job_title ?? raw.jobTitle) }
      : {}),
    workTaskRole: trimField(raw.work_task_role ?? raw.workTaskRole) ?? 'employee',
    employmentStatus: trimField(raw.employment_status ?? raw.employmentStatus) ?? 'active',
    dataScopeMax: trimField(raw.data_scope_max ?? raw.dataScopeMax) ?? 'self',
  };
}

const MAX_NOTES_LENGTH = 500;
const MAX_ADDRESS_NAME_LENGTH = 20;

export function normalizeEmployeeClientProfile(
  input: EmployeeClientProfile | null | undefined
): EmployeeClientProfile | null {
  if (!input || typeof input !== 'object') return null;

  const profile: EmployeeClientProfile = {
    ...(trimField(input.addressName)
      ? { addressName: trimField(input.addressName)!.slice(0, MAX_ADDRESS_NAME_LENGTH) }
      : {}),
    ...(trimField(input.email) ? { email: trimField(input.email) } : {}),
    ...(trimField(input.phone) ? { phone: trimField(input.phone) } : {}),
    ...(trimField(input.notes)
      ? { notes: trimField(input.notes)!.slice(0, MAX_NOTES_LENGTH) }
      : {}),
    ...(trimField(input.updatedAt) ? { updatedAt: trimField(input.updatedAt) } : {}),
  };

  return Object.keys(profile).length === 0 ? null : profile;
}

/** Merge org authority + client supplement into prompt-facing EmployeeProfile. */
export function mergeEffectiveEmployeeProfile(
  org: EmployeeOrgContext | null | undefined,
  client: EmployeeClientProfile | null | undefined
): import('./employeeProfileShared').EmployeeProfile | null {
  const normalizedClient = normalizeEmployeeClientProfile(client ?? undefined);
  if (!org && !normalizedClient) return null;

  const profile: import('./employeeProfileShared').EmployeeProfile = {
    ...(org?.displayName ? { displayName: org.displayName } : {}),
    ...(normalizedClient?.addressName ? { addressName: normalizedClient.addressName } : {}),
    ...(org?.department ? { department: org.department } : {}),
    ...(org?.jobTitle ? { jobTitle: org.jobTitle } : {}),
    ...(org?.username ? { employeeId: org.username } : {}),
    ...(normalizedClient?.email ? { email: normalizedClient.email } : {}),
    ...(normalizedClient?.phone ? { phone: normalizedClient.phone } : {}),
    ...(normalizedClient?.notes ? { notes: normalizedClient.notes } : {}),
    updatedAt: normalizedClient?.updatedAt ?? new Date().toISOString(),
  };

  if (
    !profile.displayName &&
    !profile.addressName &&
    !profile.department &&
    !profile.jobTitle &&
    !profile.employeeId &&
    !profile.email &&
    !profile.phone &&
    !profile.notes
  ) {
    return null;
  }

  return profile;
}

export function buildEmployeeProfileHandoff(
  org: EmployeeOrgContext | null,
  client: EmployeeClientProfile | null
): EmployeeProfileHandoff | null {
  if (!org && !client) return null;
  return {
    ...(org ? { org } : {}),
    ...(client ? { client } : {}),
    updatedAt: new Date().toISOString(),
  };
}
