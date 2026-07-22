/**
 * Client-side mirrors of AionCore `aionui-auth` username/password rules
 * (`validation.rs`). Keep in sync with server — server remains authoritative.
 */

const MIN_USERNAME = 3;
const MAX_USERNAME = 32;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const WEAK_PASSWORDS = new Set([
  'password',
  '12345678',
  '123456789',
  'qwertyui',
  'abcdefgh',
]);

/** Returns i18n key suffix under `orgUsers.form.*`, or null if valid. */
export type OrgFormRuleKey =
  | 'usernameRequired'
  | 'usernameLength'
  | 'usernameCharset'
  | 'usernameEdge'
  | 'passwordRequired'
  | 'passwordMin'
  | 'passwordMax'
  | 'passwordWeak';

export function checkOrgUsername(raw: string | undefined): OrgFormRuleKey | null {
  const username = (raw ?? '').trim();
  if (!username) return 'usernameRequired';
  if (username.length < MIN_USERNAME || username.length > MAX_USERNAME) {
    return 'usernameLength';
  }
  if (![...username].every((ch) => /[a-zA-Z0-9_-]/.test(ch))) {
    return 'usernameCharset';
  }
  const first = username[0];
  const last = username[username.length - 1];
  if (first === '-' || first === '_' || last === '-' || last === '_') {
    return 'usernameEdge';
  }
  return null;
}

export function checkOrgPassword(raw: string | undefined): OrgFormRuleKey | null {
  const password = raw ?? '';
  if (!password) return 'passwordRequired';
  if (password.length < MIN_PASSWORD) return 'passwordMin';
  if (password.length > MAX_PASSWORD) return 'passwordMax';
  if (WEAK_PASSWORDS.has(password.toLowerCase())) return 'passwordWeak';
  return null;
}
