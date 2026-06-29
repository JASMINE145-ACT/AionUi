/**
 * CCB-Wanding MCP health registry (mirrors ccb-installer/config/mcp-health-manifest.json).
 */

export type CcbMcpHealthServerSpec = {
  kind: 'stdio' | 'http';
  lazy?: boolean;
  optional?: boolean;
  required_paths?: string[];
  tool_prefix?: string;
  probe_tool_call?: {
    tool: string;
    arguments?: Record<string, unknown>;
  };
};

export type CcbMcpHealthAgentSpec = {
  required_mcp: string[];
  forbidden_mcp?: string[];
  skills?: string[];
  optional?: boolean;
};

export const CCB_MCP_HEALTH_MANIFEST: {
  mcp_servers: Record<string, CcbMcpHealthServerSpec>;
  agent_profiles: Record<string, CcbMcpHealthAgentSpec>;
} = {
  mcp_servers: {
    quotation: {
      kind: 'stdio' as const,
      lazy: false,
      required_paths: [
        'vendor/bun/bun.exe',
        'vendor/mcp-servers/quotation-server/dist/index.js',
        'vendor/python-wanding/python.exe',
        'vendor/wanding/data',
        'vendor/wanding/python/main.py',
      ],
      tool_prefix: 'mcp__quotation__',
      probe_tool_call: {
        tool: 'match_quotation',
        arguments: { keywords: 'pipe', showAllCandidates: true },
      },
    },
    accurate: {
      kind: 'stdio' as const,
      lazy: false,
      required_paths: [
        'vendor/python-wanding/python.exe',
        'vendor/mcp-servers/accurate-mcp/server.py',
      ],
      tool_prefix: 'mcp__accurate__',
    },
    'office-word': {
      kind: 'stdio' as const,
      lazy: false,
      required_paths: [
        'vendor/python-wanding/python.exe',
        'vendor/mcp-servers/office-word-mcp/server.py',
        'vendor/mcp-servers/office-word-mcp/site-packages',
      ],
      tool_prefix: 'mcp__office-word__',
    },
    excel: {
      kind: 'stdio' as const,
      lazy: false,
      required_paths: [
        'vendor/python-wanding/python.exe',
        'vendor/mcp-servers/excel-mcp-server/server.py',
        'vendor/mcp-servers/excel-mcp-server/site-packages',
      ],
      tool_prefix: 'mcp__excel__',
    },
    'excel-mcp': {
      kind: 'stdio' as const,
      lazy: true,
      optional: true,
      required_paths: ['vendor/mcp-servers/excel-mcp/mcp-excel.exe'],
    },
    exa: {
      kind: 'http' as const,
      lazy: true,
      optional: true,
    },
  },
  agent_profiles: {
    'wande-orchestrator': {
      required_mcp: [],
      forbidden_mcp: ['quotation', 'accurate', 'office-word', 'excel'],
    },
    'quotation-agent': { required_mcp: ['quotation'] },
    'accurate-agent': { required_mcp: ['accurate'] },
    'word-creator': { required_mcp: ['office-word'] },
    'excel-creator': { required_mcp: ['excel'] },
    'ppt-creator': { required_mcp: [], skills: ['ppt-master'], optional: true },
  },
};

/** Core MCP servers probed during health check (non-lazy, non-optional). */
export const CCB_MCP_HEALTH_PROBE_SERVERS = ['quotation', 'accurate', 'office-word', 'excel'] as const;
