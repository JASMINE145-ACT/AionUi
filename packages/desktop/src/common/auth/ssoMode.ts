/**
 * Unified org SSO (OpenSpec unified-org-sso): login POST targets org IdP only.
 */

export function isUnifiedOrgSsoEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const mode = (window as Window & { __ssoMode?: string }).__ssoMode;
    if (mode === 'org-idp') {
      return true;
    }
  }
  return process.env.AIONUI_SSO_MODE === 'org-idp';
}
