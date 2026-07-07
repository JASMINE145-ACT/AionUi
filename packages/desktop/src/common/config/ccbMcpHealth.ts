/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * CCB-Wanding MCP health — config/files/agents + optional live probe.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import {
  repairExcelCreatorExcelMcp,
  repairWanDSubagentMcpServers,
  repairWordCreatorOfficeWordMcp,
} from './ccbAgentMigration';
import type { CcbSettingsJson } from './ccbMcpSettings';
import { listCcbMcpServersWithHealth } from './ccbMcpSettings';
import { resolveCcbClaudeConfigDir } from './ccbWandingRuntime';
import {
  CCB_MCP_HEALTH_MANIFEST,
  CCB_MCP_HEALTH_DEEP_PROBE_SERVERS,
  CCB_MCP_HEALTH_PROBE_SERVERS,
} from './ccbMcpHealthManifest';
import {
  diagnoseCcbMcpHealth,
  isWhitelistedRepairAction,
  type CcbMcpHealthDiagnosis,
  type CcbMcpHealthRepairActionId,
} from './ccbMcpHealthDiagnosis';
import {
  resolveCcbInstallerRoot,
  resolveCcbWandingCliPath,
  resolveCcbWandingInstallDir,
} from './ccbWandingRuntimeNode';

export type {
  CcbMcpHealthItem,
  CcbMcpHealthLayerResult,
  CcbMcpHealthReport,
  CcbMcpHealthRepairResult,
} from './ccbMcpHealthShared';
export {
  collectCcbMcpHealthFailedItems,
  collectCcbMcpHealthWarnItems,
} from './ccbMcpHealthShared';
import type {
  CcbMcpHealthItem,
  CcbMcpHealthLayerResult,
  CcbMcpHealthReport,
  CcbMcpHealthRepairResult,
} from './ccbMcpHealthShared';

const EXA_MCP_URL = 'https://mcp.exa.ai/mcp';
const EXA_HTTP_PROBE_TIMEOUT_MS = 8000;

export type CcbMcpHealthOptions = {
  probe?: boolean;
  session?: boolean;
};

function splitLayer1Items(items: CcbMcpHealthItem[]): {
  config: CcbMcpHealthLayerResult;
  files?: CcbMcpHealthLayerResult;
  agents?: CcbMcpHealthLayerResult;
} {
  const configItems = items.filter((item) => item.layer === 'config');
  const fileItems = items.filter((item) => item.layer === 'files');
  const agentItems = items.filter((item) => item.layer === 'agents');
  return {
    config: { ok: layerOk(configItems), items: configItems },
    files: fileItems.length > 0 ? { ok: layerOk(fileItems), items: fileItems } : undefined,
    agents: agentItems.length > 0 ? { ok: layerOk(agentItems), items: agentItems } : undefined,
  };
}

function readSettingsJson(path: string): CcbSettingsJson | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as CcbSettingsJson;
  } catch {
    return null;
  }
}

function runConfigLayer(configDir: string, installDir: string | null): CcbMcpHealthItem[] {
  const items: CcbMcpHealthItem[] = [];
  const settingsPath = join(configDir, 'settings.json');
  const agentsDir = join(configDir, 'agents');

  if (!existsSync(settingsPath)) {
    items.push({
      layer: 'config',
      id: 'settings.json',
      ok: false,
      detail: `missing: ${settingsPath}`,
    });
    return items;
  }

  const settings = readSettingsJson(settingsPath);
  if (!settings) {
    items.push({ layer: 'config', id: 'settings.json', ok: false, detail: 'invalid JSON' });
    return items;
  }

  const mcpServers = settings.mcpServers ?? {};
  for (const [name, spec] of Object.entries(CCB_MCP_HEALTH_MANIFEST.mcp_servers)) {
    if (spec.optional) continue;
    if (mcpServers[name]) {
      items.push({ layer: 'config', id: `mcp:${name}`, ok: true, detail: 'registered' });
    } else {
      items.push({
        layer: 'config',
        id: `mcp:${name}`,
        ok: false,
        detail: 'not in settings.json mcpServers',
      });
    }
  }

  const quotationEntry = mcpServers.quotation as { env?: Record<string, string> } | undefined;
  const ccbProjectRoot = quotationEntry?.env?.CCB_PROJECT_ROOT?.trim() ?? '';
  if (!ccbProjectRoot) {
    items.push({
      layer: 'config',
      id: 'quotation.env.CCB_PROJECT_ROOT',
      ok: false,
      detail: 'missing in settings.json mcpServers.quotation.env',
    });
  } else {
    const mainPy = join(ccbProjectRoot, 'python', 'main.py');
    items.push({
      layer: 'config',
      id: 'quotation.env.CCB_PROJECT_ROOT',
      ok: existsSync(mainPy),
      detail: existsSync(mainPy)
        ? `python/main.py exists under ${ccbProjectRoot}`
        : `python/main.py missing under ${ccbProjectRoot}`,
    });
  }

  if (installDir) {
    for (const [name, spec] of Object.entries(CCB_MCP_HEALTH_MANIFEST.mcp_servers)) {
      for (const rel of spec.required_paths ?? []) {
        const full = join(installDir, rel);
        items.push({
          layer: 'files',
          id: `${name}/${rel}`,
          ok: existsSync(full),
          detail: existsSync(full) ? 'exists' : `missing: ${full}`,
        });
      }
    }
  }

  for (const [agentId, spec] of Object.entries(CCB_MCP_HEALTH_MANIFEST.agent_profiles)) {
    if (spec.optional) continue;
    const mdPath = join(agentsDir, `${agentId}.md`);
    const sidecarPath = join(agentsDir, `${agentId}.aionui.json`);
    if (!existsSync(mdPath)) {
      items.push({
        layer: 'agents',
        id: agentId,
        ok: false,
        detail: `missing ${mdPath}`,
      });
      continue;
    }
    if (!existsSync(sidecarPath)) {
      items.push({
        layer: 'agents',
        id: agentId,
        ok: false,
        detail: `missing sidecar ${sidecarPath}`,
      });
      continue;
    }
    try {
      const sidecar = JSON.parse(
        readFileSync(sidecarPath, 'utf8').replace(/^\uFEFF/, '')
      ) as { mcp_allowlist?: string[] };
      const allow = sidecar.mcp_allowlist ?? [];
      const missing = spec.required_mcp.filter((m) => !allow.includes(m));
      items.push({
        layer: 'agents',
        id: agentId,
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? 'deployed; allowlist ok'
            : `sidecar mcp_allowlist missing: ${missing.join(', ')}`,
      });
    } catch {
      items.push({ layer: 'agents', id: agentId, ok: false, detail: 'invalid sidecar JSON' });
    }
  }

  return items;
}

async function runManifestDeepProbe(
  serverName: string,
  configDir: string,
  installDir: string | null
): Promise<CcbMcpHealthItem | null> {
  const serverSpec = CCB_MCP_HEALTH_MANIFEST.mcp_servers[serverName];
  if (!serverSpec?.probe_tool_call && !serverSpec?.probe_inventory_call) {
    return null;
  }
  if (!installDir) {
    return {
      layer: 'probe',
      id: `${serverName}:deep`,
      ok: false,
      detail: 'install dir not found for deep probe',
    };
  }

  const installerRoot = resolveCcbInstallerRoot();
  const probeScript = installerRoot
    ? join(installerRoot, 'scripts', 'test-mcp-probe-layer.mjs')
    : null;
  if (!probeScript || !existsSync(probeScript)) {
    return {
      layer: 'probe',
      id: `${serverName}:deep`,
      ok: false,
      detail: 'installer probe script not found (CCB_INSTALLER_ROOT)',
    };
  }

  return new Promise((resolveItem) => {
    const child = spawn('node', [probeScript, `--server=${serverName}`], {
      env: {
        ...process.env,
        CCB_INSTALL_DIR: installDir,
        CLAUDE_CONFIG_DIR: configDir,
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      const tool = serverSpec.probe_tool_call?.tool ?? serverSpec.probe_inventory_call?.tool ?? 'tools/call';
      if (code === 0 && new RegExp(`\\[mcp-probe\\] PASS ${serverName}`).test(stdout)) {
        const toolLine = stdout
          .split(/\r?\n/)
          .find((line) => line.includes(`[mcp-probe] PASS ${serverName}`));
        const toolNote = toolLine?.includes('tool_call=')
          ? toolLine.split('tool_call=')[1]?.split(/\s/)[0]
          : tool;
        resolveItem({
          layer: 'probe',
          id: `${serverName}:deep`,
          ok: true,
          detail: `tools/call ${toolNote ?? tool} ok`,
        });
        return;
      }
      const detail =
        stderr.trim() ||
        stdout
          .split(/\r?\n/)
          .find((line) => line.includes(`[mcp-probe] FAIL ${serverName}`))
          ?.replace(new RegExp(`^\\[mcp-probe\\] FAIL ${serverName}:\\s*`), '') ||
        `probe exit ${code ?? 'unknown'}`;
      resolveItem({
        layer: 'probe',
        id: `${serverName}:deep`,
        ok: false,
        detail,
      });
    });
  });
}

async function runSessionLayer(configDir: string, installDir: string | null): Promise<CcbMcpHealthItem[]> {
  const items: CcbMcpHealthItem[] = [];
  if (!installDir) {
    items.push({
      layer: 'session',
      id: 'session-probe',
      ok: false,
      detail: 'CCB-Wanding install dir not found',
    });
    return items;
  }

  const installerRoot = resolveCcbInstallerRoot();
  const sessionScript = installerRoot
    ? join(installerRoot, 'test-mcp-session-health.mjs')
    : null;
  if (!sessionScript || !existsSync(sessionScript)) {
    items.push({
      layer: 'session',
      id: 'session-probe',
      ok: false,
      detail: 'test-mcp-session-health.mjs not found (ccb-installer)',
    });
    return items;
  }

  return new Promise((resolveItems) => {
    const child = spawn('node', [sessionScript], {
      env: {
        ...process.env,
        CCB_INSTALL_DIR: installDir,
        CLAUDE_CONFIG_DIR: configDir,
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      const lines = stdout.split(/\r?\n/);
      const profileLines = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => /^\[session-health\] (PASS|FAIL) /.test(line));

      if (profileLines.length === 0) {
        resolveItems([
          {
            layer: 'session',
            id: 'session-probe',
            ok: false,
            detail: stderr.trim() || stdout.trim() || `session probe exit ${code ?? 'unknown'}`,
          },
        ]);
        return;
      }

      for (const { line, index } of profileLines) {
        const match = line.match(/^\[session-health\] (PASS|FAIL) (\S+)/);
        if (!match) continue;
        const [, status, profileId] = match;
        let detail =
          status === 'PASS'
            ? 'ACP session profile MCP allowlist ok'
            : 'session profile MCP mismatch — open a new specialist Guid card (handoff ≤300s)';
        if (status === 'FAIL') {
          for (let j = index + 1; j < lines.length; j++) {
            if (/^\[session-health\]/.test(lines[j])) break;
            const errorMatch = lines[j].trim().match(/^error:\s*(.+)$/);
            if (errorMatch) {
              detail = errorMatch[1];
              break;
            }
          }
        }
        items.push({
          layer: 'session',
          id: profileId,
          ok: status === 'PASS',
          detail,
        });
      }

      if (items.length === 0) {
        items.push({
          layer: 'session',
          id: 'session-probe',
          ok: code === 0,
          detail: code === 0 ? 'all profiles passed' : stderr.trim() || 'session probe failed',
        });
      }
      resolveItems(items);
    });
  });
}

async function runProbeLayer(configDir: string, installDir: string | null): Promise<CcbMcpHealthItem[]> {
  const items: CcbMcpHealthItem[] = [];
  if (!resolveCcbWandingCliPath()) {
    items.push({
      layer: 'probe',
      id: 'ccb-cli',
      ok: false,
      detail: 'CCB-Wanding CLI not found (cannot probe MCP)',
    });
    return items;
  }

  const servers = await listCcbMcpServersWithHealth(configDir, { test: true });
  const byName = Object.fromEntries(servers.map((s) => [s.name, s]));

  for (const name of CCB_MCP_HEALTH_PROBE_SERVERS) {
    const server = byName[name];
    if (!server) {
      items.push({
        layer: 'probe',
        id: name,
        ok: false,
        detail: 'not registered in settings',
      });
      continue;
    }
    if (!server.enabled) {
      items.push({ layer: 'probe', id: name, ok: false, detail: 'disabled in settings' });
      continue;
    }
    if (server.last_test_status === 'connected') {
      const toolCount = server.tools?.length ?? 0;
      items.push({
        layer: 'probe',
        id: name,
        ok: toolCount > 0,
        detail:
          toolCount > 0
            ? `connected; ${toolCount} tools`
            : 'connected but no tools returned',
      });
      continue;
    }
    items.push({
      layer: 'probe',
      id: name,
      ok: false,
      detail: server.last_test_status === 'error' ? 'connection failed' : 'probe returned no status',
    });
  }

  for (const name of CCB_MCP_HEALTH_DEEP_PROBE_SERVERS) {
    const deepProbe = await runManifestDeepProbe(name, configDir, installDir);
    if (deepProbe) {
      items.push(deepProbe);
    }
  }

  return items;
}

function itemBlocksOk(item: CcbMcpHealthItem): boolean {
  return !item.ok && !item.warn;
}

function layerOk(items: CcbMcpHealthItem[]): boolean {
  return items.length > 0 && items.every((item) => !itemBlocksOk(item));
}

/** Streamable HTTP MCP (exa) often returns 405 for HEAD/GET — still proves host reachability. */
function httpStatusIndicatesReachable(status: number): boolean {
  if (status >= 200 && status < 400) {
    return true;
  }
  // 4xx = server responded (MCP rejects probe method); not a network failure.
  if (status >= 400 && status < 500) {
    return true;
  }
  return false;
}

function formatExaHttpProbeDetail(status: number, method: string): string {
  if (status >= 200 && status < 400) {
    return `mcp.exa.ai reachable (HTTP ${status})`;
  }
  if (status >= 400 && status < 500) {
    return `mcp.exa.ai reachable (HTTP ${status} — MCP rejects ${method}; connectivity OK)`;
  }
  return `upstream error HTTP ${status} (research-agent may fail)`;
}

async function probeHttpReachable(
  url: string,
  timeoutMs = EXA_HTTP_PROBE_TIMEOUT_MS
): Promise<{ reachable: boolean; detail: string }> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const resp = await fetch(url, { method, signal: AbortSignal.timeout(timeoutMs) });
      if (httpStatusIndicatesReachable(resp.status)) {
        return { reachable: true, detail: formatExaHttpProbeDetail(resp.status, method) };
      }
      if (resp.status >= 500) {
        return { reachable: false, detail: formatExaHttpProbeDetail(resp.status, method) };
      }
    } catch {
      // try GET after HEAD failure
    }
  }
  return {
    reachable: false,
    detail:
      'connection failed: timeout, DNS, or refused (research-agent may fail; core MCP unaffected)',
  };
}

async function runOptionalLayer(
  configDir: string,
  installDir: string | null
): Promise<CcbMcpHealthItem[]> {
  const items: CcbMcpHealthItem[] = [];
  const settingsPath = join(configDir, 'settings.json');
  const settings = existsSync(settingsPath) ? readSettingsJson(settingsPath) : null;
  const mcpServers = settings?.mcpServers ?? {};
  const exa = mcpServers.exa as { url?: string } | undefined;

  if (exa?.url) {
    if (exa.url !== EXA_MCP_URL) {
      items.push({
        layer: 'optional',
        id: 'exa:config',
        ok: false,
        warn: true,
        detail: `unexpected URL: ${exa.url} (expected ${EXA_MCP_URL})`,
      });
    } else {
      const probe = await probeHttpReachable(exa.url);
      items.push({
        layer: 'optional',
        id: 'exa:http',
        ok: probe.reachable,
        warn: !probe.reachable,
        detail: probe.detail,
      });
    }
  } else {
    items.push({
      layer: 'optional',
      id: 'exa:http',
      ok: true,
      detail: 'not registered (optional)',
    });
  }

  const configSkillPath = join(configDir, 'skills', 'ppt-master', 'SKILL.md');
  const configSkillOk = existsSync(configSkillPath);
  items.push({
    layer: 'optional',
    id: 'ppt-master:config-skill',
    ok: configSkillOk,
    warn: !configSkillOk,
    detail: configSkillOk
      ? 'skills/ppt-master/SKILL.md exists'
      : `missing: ${configSkillPath} — run install-ppt-master.ps1`,
  });

  if (installDir) {
    const vendorSkillPath = join(installDir, 'vendor', 'ppt-master-skill', 'SKILL.md');
    const vendorSkillOk = existsSync(vendorSkillPath);
    items.push({
      layer: 'optional',
      id: 'ppt-master:vendor-skill',
      ok: vendorSkillOk,
      warn: !vendorSkillOk,
      detail: vendorSkillOk
        ? 'vendor/ppt-master-skill/SKILL.md exists'
        : `missing: ${vendorSkillPath}`,
    });
  }

  return items;
}

export async function runCcbMcpHealthCheck(
  options: CcbMcpHealthOptions = {}
): Promise<CcbMcpHealthReport> {
  const configDir = resolveCcbClaudeConfigDir();
  if (!configDir) {
    const fail: CcbMcpHealthItem = {
      layer: 'config',
      id: 'ccb-config',
      ok: false,
      detail: 'CCB-Wanding config directory not found',
    };
    return {
      ok: false,
      checked_at: new Date().toISOString(),
      config: { ok: false, items: [fail] },
    };
  }

  const installDir = resolveCcbWandingInstallDir();
  const layer1Items = runConfigLayer(configDir, installDir);
  const { config: configLayer, files: filesLayer, agents: agentsLayer } = splitLayer1Items(layer1Items);

  let probeLayer: CcbMcpHealthLayerResult | undefined;
  if (options.probe) {
    const probeItems = await runProbeLayer(configDir, installDir);
    probeLayer = { ok: layerOk(probeItems), items: probeItems };
  }

  let sessionLayer: CcbMcpHealthLayerResult | undefined;
  if (options.session) {
    const sessionItems = await runSessionLayer(configDir, installDir);
    sessionLayer = { ok: layerOk(sessionItems), items: sessionItems };
  }

  const optionalItems = await runOptionalLayer(configDir, installDir);
  const optionalLayer: CcbMcpHealthLayerResult = {
    ok: layerOk(optionalItems),
    items: optionalItems,
  };

  const layer1Ok = configLayer.ok && (filesLayer?.ok ?? true) && (agentsLayer?.ok ?? true);
  const ok =
    layer1Ok &&
    (probeLayer ? probeLayer.ok : true) &&
    (sessionLayer ? sessionLayer.ok : true) &&
    optionalLayer.ok;
  const report: CcbMcpHealthReport = {
    ok,
    checked_at: new Date().toISOString(),
    config: configLayer,
    files: filesLayer,
    agents: agentsLayer,
    probe: probeLayer,
    session: sessionLayer,
    optional: optionalLayer,
  };
  if (!ok) {
    report.diagnosis = diagnoseCcbMcpHealth(report);
  }
  return report;
}

function spawnPowerShellScript(scriptPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `PowerShell exit ${code}`));
      }
    });
  });
}

function spawnNodeScript(scriptPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `node exit ${code}`));
      }
    });
  });
}

export type CcbMcpHealthRepairOptions = {
  /** Whitelisted action ids; defaults to full standard repair sequence */
  actionIds?: CcbMcpHealthRepairActionId[];
};

async function runRepairAction(
  actionId: CcbMcpHealthRepairActionId,
  configDir: string,
  installDir: string | null
): Promise<{ id: string; ok: boolean; detail: string }> {
  const installerRoot = resolveCcbInstallerRoot();

  switch (actionId) {
    case 'ensure-wanding-settings': {
      const ensureScript =
        installerRoot && existsSync(join(installerRoot, 'scripts', 'ensure-wanding-settings.ps1'))
          ? join(installerRoot, 'scripts', 'ensure-wanding-settings.ps1')
          : installDir && existsSync(join(installDir, 'scripts', 'ensure-wanding-settings.ps1'))
            ? join(installDir, 'scripts', 'ensure-wanding-settings.ps1')
            : null;
      if (!ensureScript || !installDir || process.platform !== 'win32') {
        return {
          id: actionId,
          ok: false,
          detail:
            process.platform !== 'win32'
              ? 'ensure-wanding-settings.ps1 requires Windows'
              : 'ensure-wanding-settings.ps1 not found',
        };
      }
      try {
        await spawnPowerShellScript(ensureScript, ['-InstallDir', installDir, '-ConfigDir', configDir]);
        return { id: actionId, ok: true, detail: 'settings.json refreshed' };
      } catch (error) {
        return {
          id: actionId,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }
    case 'deploy-seed-agents': {
      const mjs =
        installerRoot && existsSync(join(installerRoot, 'scripts', 'deploy-seed-agents.mjs'))
          ? join(installerRoot, 'scripts', 'deploy-seed-agents.mjs')
          : null;
      if (!mjs) {
        return { id: actionId, ok: false, detail: 'deploy-seed-agents.mjs not found (ccb-installer)' };
      }
      try {
        await spawnNodeScript(mjs, [`--config=${join(configDir, 'agents')}`, '--force-md']);
        return { id: actionId, ok: true, detail: 'agent seeds deployed' };
      } catch (error) {
        return {
          id: actionId,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }
    case 'repair-word-creator': {
      try {
        const word = await repairWordCreatorOfficeWordMcp(configDir);
        return {
          id: actionId,
          ok: word.repaired.length > 0 || word.skipped.includes('word-creator'),
          detail: word.repaired.length ? `repaired: ${word.repaired.join(', ')}` : 'already ok',
        };
      } catch (error) {
        return {
          id: actionId,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }
    case 'repair-excel-creator': {
      try {
        const excel = await repairExcelCreatorExcelMcp(configDir);
        return {
          id: actionId,
          ok: excel.repaired.length > 0 || excel.skipped.includes('excel-creator'),
          detail: excel.repaired.length ? `repaired: ${excel.repaired.join(', ')}` : 'already ok',
        };
      } catch (error) {
        return {
          id: actionId,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }
    case 'repair-subagent-mcp': {
      try {
        const mcp = await repairWanDSubagentMcpServers(configDir);
        return {
          id: actionId,
          ok: mcp.repaired.length > 0 || mcp.skipped.length > 0,
          detail: mcp.repaired.length ? `repaired: ${mcp.repaired.join(', ')}` : 'already ok',
        };
      } catch (error) {
        return {
          id: actionId,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }
    default:
      return { id: actionId, ok: false, detail: 'unknown repair action' };
  }
}

const DEFAULT_REPAIR_ACTIONS: CcbMcpHealthRepairActionId[] = [
  'ensure-wanding-settings',
  'deploy-seed-agents',
  'repair-word-creator',
  'repair-excel-creator',
  'repair-subagent-mcp',
];

export async function repairCcbMcpHealth(
  options: CcbMcpHealthRepairOptions = {}
): Promise<CcbMcpHealthRepairResult> {
  const configDir = resolveCcbClaudeConfigDir();
  const installDir = resolveCcbWandingInstallDir();
  const steps: CcbMcpHealthRepairResult['steps'] = [];

  if (!configDir) {
    return {
      ok: false,
      steps: [{ id: 'config', ok: false, detail: 'CCB config dir not found' }],
    };
  }

  const requested = options.actionIds?.length ? options.actionIds : DEFAULT_REPAIR_ACTIONS;
  const actionIds = requested.filter(isWhitelistedRepairAction);
  if (actionIds.length === 0) {
    return {
      ok: false,
      steps: [{ id: 'repair', ok: false, detail: 'no whitelisted repair actions requested' }],
    };
  }

  for (const actionId of actionIds) {
    steps.push(await runRepairAction(actionId, configDir, installDir));
  }

  return { ok: steps.every((s) => s.ok), steps };
}
