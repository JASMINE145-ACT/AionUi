/**
 * CCB-Wanding MCP health registry (mirrors ccb-installer/config/mcp-health-manifest.json).
 */

export type CcbMcpHealthServerSpec = {
  kind: 'stdio' | 'http';
  lazy?: boolean;
  optional?: boolean;
  required_paths?: string[];
  tool_prefix?: string;
  probe_timeout_ms?: number;
  probe_tool_call?: {
    tool: string;
    arguments?: Record<string, unknown>;
    reject_patterns?: string[];
  };
  probe_inventory_call?: {
    tool: string;
    arguments?: Record<string, unknown>;
    reject_patterns?: string[];
  };
};

export type CcbMcpHealthAgentSpec = {
  required_mcp: string[];
  forbidden_mcp?: string[];
  skills?: string[];
  optional?: boolean;
  optional_mcp?: string[];
  notes?: string;
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
        'vendor/wanding/.env.accurate',
      ],
      tool_prefix: 'mcp__quotation__',
      probe_timeout_ms: 90000,
      probe_tool_call: {
        tool: 'match_quotation',
        arguments: { keywords: 'pipe', showAllCandidates: true },
      },
      probe_inventory_call: {
        tool: 'get_inventory_by_code',
        arguments: { code: 'HEALTH-PROBE' },
        reject_patterns: ['inventory_unavailable', 'not configured', 'AOL_ACCESS_TOKEN'],
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
      probe_timeout_ms: 120000,
      probe_tool_call: {
        tool: 'accurate_summarize_records',
        arguments: {
          table_name: 'purchase-invoice',
          start_date: '01/01/2026',
          end_date: '31/01/2026',
          group_by: 'month',
          page_size: 10,
          max_pages: 1,
        },
        reject_patterns: [
          'AOL_ACCESS_TOKEN 未设置',
          'AOL_SIGNATURE_SECRET 未设置',
          'AOL_DATABASE_ID 未设置',
          '[参数错误]',
          '[API 错误]',
        ],
      },
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
      probe_timeout_ms: 90000,
      probe_tool_call: {
        tool: 'list_available_documents',
        arguments: { directory: '.' },
      },
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
      probe_timeout_ms: 45000,
      probe_tool_call: {
        tool: 'create_workbook',
        arguments: { filepath: 'ccb-health-probe.xlsx' },
      },
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
    scrapling: {
      kind: 'stdio' as const,
      lazy: true,
      optional: true,
    },
    'price-library': {
      kind: 'stdio' as const,
      lazy: false,
      required_paths: [
        'vendor/bun/bun.exe',
        'vendor/mcp-servers/price-library-server/dist/index.js',
        'vendor/python-wanding/python.exe',
        'vendor/wanding/python/price_library_main.py',
      ],
      tool_prefix: 'mcp__price-library__',
      probe_timeout_ms: 60000,
      probe_tool_call: {
        tool: 'get_price_library_active',
        arguments: {},
      },
    },
  },
  agent_profiles: {
    'wande-orchestrator': {
      required_mcp: [],
      forbidden_mcp: ['quotation', 'accurate', 'office-word', 'excel'],
    },
    'quotation-agent': { required_mcp: ['quotation', 'excel'] },
    'accurate-agent': { required_mcp: ['accurate'] },
    'word-creator': { required_mcp: ['office-word'] },
    'excel-creator': { required_mcp: ['excel'] },
    'ppt-creator': { required_mcp: [], skills: ['ppt-master'], optional: true },
    'research-agent': {
      required_mcp: ['exa'],
      optional_mcp: ['scrapling'],
      optional: true,
    },
    'price-library-agent': {
      required_mcp: ['price-library'],
      optional_mcp: ['excel'],
    },
  },
};

/** Core MCP servers probed during health check (non-lazy, non-optional). */
export const CCB_MCP_HEALTH_PROBE_SERVERS = [
  'quotation',
  'accurate',
  'office-word',
  'excel',
  'price-library',
] as const;

/** Servers with manifest deep probe (tools/call via installer script). */
export const CCB_MCP_HEALTH_DEEP_PROBE_SERVERS = CCB_MCP_HEALTH_PROBE_SERVERS.filter(
  (name) =>
    Boolean(CCB_MCP_HEALTH_MANIFEST.mcp_servers[name]?.probe_tool_call) ||
    Boolean(CCB_MCP_HEALTH_MANIFEST.mcp_servers[name]?.probe_inventory_call)
);
