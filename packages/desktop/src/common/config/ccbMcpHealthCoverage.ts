/**
 * MCP health coverage matrix — mirrors .trellis/spec/integration/mcp-health.md § MCP + Skill coverage.
 */

export type CcbMcpHealthCoverageTier = 'core' | 'lazy' | 'optional' | 'skill' | 'other';

export type CcbMcpHealthCoverageRow = {
  id: string;
  label: string;
  tier: CcbMcpHealthCoverageTier;
  uiQuick: boolean;
  uiProbe: boolean;
  uiDeep: boolean;
  uiSession: boolean;
  cliSession: boolean;
  notes?: string;
};

export const CCB_MCP_HEALTH_COVERAGE_ROWS: CcbMcpHealthCoverageRow[] = [
  {
    id: 'quotation',
    label: 'quotation',
    tier: 'core',
    uiQuick: true,
    uiProbe: true,
    uiDeep: true,
    uiSession: true,
    cliSession: true,
  },
  {
    id: 'accurate',
    label: 'accurate',
    tier: 'core',
    uiQuick: true,
    uiProbe: true,
    uiDeep: true,
    uiSession: true,
    cliSession: true,
  },
  {
    id: 'office-word',
    label: 'office-word',
    tier: 'core',
    uiQuick: true,
    uiProbe: true,
    uiDeep: true,
    uiSession: true,
    cliSession: true,
  },
  {
    id: 'excel',
    label: 'excel',
    tier: 'core',
    uiQuick: true,
    uiProbe: true,
    uiDeep: true,
    uiSession: true,
    cliSession: true,
  },
  {
    id: 'excel-mcp',
    label: 'excel-mcp (COM)',
    tier: 'lazy',
    uiQuick: false,
    uiProbe: false,
    uiDeep: false,
    uiSession: false,
    cliSession: false,
    notes: 'Requires Microsoft Excel',
  },
  {
    id: 'exa',
    label: 'exa (HTTP)',
    tier: 'optional',
    uiQuick: true,
    uiProbe: false,
    uiDeep: false,
    uiSession: false,
    cliSession: false,
    notes: 'research-agent; HTTP WARN if unreachable',
  },
  {
    id: 'scrapling',
    label: 'scrapling',
    tier: 'optional',
    uiQuick: false,
    uiProbe: false,
    uiDeep: false,
    uiSession: false,
    cliSession: false,
    notes: 'research extended profile',
  },
  {
    id: 'ppt-master',
    label: 'ppt-master skill',
    tier: 'skill',
    uiQuick: true,
    uiProbe: false,
    uiDeep: false,
    uiSession: false,
    cliSession: false,
    notes: 'ppt-creator; config + vendor SKILL.md',
  },
  {
    id: 'roe-hooks',
    label: 'ccb-subagent-gate / ROE',
    tier: 'other',
    uiQuick: false,
    uiProbe: false,
    uiDeep: false,
    uiSession: false,
    cliSession: false,
    notes: 'smoke-roe-deploy.ps1',
  },
];
