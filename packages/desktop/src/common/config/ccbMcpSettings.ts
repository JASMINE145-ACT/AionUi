/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { IMcpServer, IMcpServerTransport } from '@/common/config/storage'
import {
  CCB_RESERVED_MCP_NAMES,
  resolveCcbClaudeConfigDir,
} from './ccbWandingRuntime'
import { resolveCcbWandingCliPath } from './ccbWandingRuntimeNode'
import {
  mergeMcpIntoCcbSettings,
  mcpServerToSettingsEntry,
  normalizeMcpServerName,
} from './ccbConfigMigrationShared'

export type CcbSettingsJson = {
  mcpServers?: Record<string, Record<string, unknown>>
  disabledMcpjsonServers?: string[]
  [key: string]: unknown
}

export type CcbMcpTestResult = {
  success: boolean
  tools?: Array<{ name: string; description?: string; input_schema?: unknown }>
  error?: string
  needsAuth?: boolean
}

function ccbMcpServerId(name: string): string {
  return `ccb-mcp:${normalizeMcpServerName(name) || name.trim()}`
}

function settingsEntryToTransport(entry: Record<string, unknown>): IMcpServerTransport | null {
  const type = typeof entry.type === 'string' ? entry.type : undefined
  if (type === 'stdio' || (!type && typeof entry.command === 'string')) {
    return {
      type: 'stdio',
      command: String(entry.command),
      ...(Array.isArray(entry.args) ? { args: entry.args.map(String) } : {}),
      ...(entry.env && typeof entry.env === 'object' && !Array.isArray(entry.env)
        ? { env: entry.env as Record<string, string> }
        : {}),
    }
  }
  if (type === 'sse' && typeof entry.url === 'string') {
    return {
      type: 'sse',
      url: entry.url,
      ...(entry.headers && typeof entry.headers === 'object' && !Array.isArray(entry.headers)
        ? { headers: entry.headers as Record<string, string> }
        : {}),
    }
  }
  if ((type === 'http' || type === 'streamable_http') && typeof entry.url === 'string') {
    return {
      type: type === 'streamable_http' ? 'streamable_http' : 'http',
      url: entry.url,
      ...(entry.headers && typeof entry.headers === 'object' && !Array.isArray(entry.headers)
        ? { headers: entry.headers as Record<string, string> }
        : {}),
    }
  }
  return null
}

function isServerDisabled(name: string, settings: CcbSettingsJson): boolean {
  const disabled = settings.disabledMcpjsonServers ?? []
  const normalized = normalizeMcpServerName(name)
  return disabled.some((entry) => normalizeMcpServerName(entry) === normalized)
}

async function readSettingsJson(configDir: string): Promise<CcbSettingsJson> {
  const settingsPath = join(configDir, 'settings.json')
  if (!existsSync(settingsPath)) {
    return {}
  }
  const raw = (await readFile(settingsPath, 'utf8')).replace(/^\uFEFF/, '')
  return JSON.parse(raw) as CcbSettingsJson
}

async function backupSettingsJson(configDir: string): Promise<void> {
  const settingsPath = join(configDir, 'settings.json')
  if (!existsSync(settingsPath)) {
    return
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await copyFile(settingsPath, join(configDir, `settings.json.aionui-mcp-backup-${stamp}`))
}

async function writeSettingsJson(configDir: string, settings: CcbSettingsJson): Promise<void> {
  await mkdir(configDir, { recursive: true })
  await writeFile(join(configDir, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
}

function manifestStatusToTestStatus(
  status?: string
): IMcpServer['last_test_status'] | undefined {
  switch (status) {
    case 'connected':
      return 'connected'
    case 'needs-auth':
    case 'error':
      return 'error'
    case 'disconnected':
      return 'disconnected'
    default:
      return undefined
  }
}

function settingsServerToIMcpServer(
  name: string,
  entry: Record<string, unknown>,
  settings: CcbSettingsJson,
  health?: { status?: string; statusMessage?: string; tools?: CcbMcpTestResult['tools'] }
): IMcpServer | null {
  const transport = settingsEntryToTransport(entry)
  if (!transport) {
    return null
  }

  const now = Date.now()
  const description = typeof entry.description === 'string' ? entry.description : undefined
  const reserved = CCB_RESERVED_MCP_NAMES.has(normalizeMcpServerName(name))

  return {
    id: ccbMcpServerId(name),
    name,
    description,
    enabled: !isServerDisabled(name, settings),
    transport,
    tools: health?.tools,
    last_test_status: manifestStatusToTestStatus(health?.status),
    last_connected: health?.status === 'connected' ? now : undefined,
    created_at: now,
    updated_at: now,
    original_json: JSON.stringify(entry, null, 2),
    builtin: reserved,
  }
}

export async function listCcbMcpServers(configDir = resolveCcbClaudeConfigDir()): Promise<IMcpServer[]> {
  if (!configDir) {
    return []
  }
  const settings = await readSettingsJson(configDir)
  const servers: IMcpServer[] = []

  for (const [name, entry] of Object.entries(settings.mcpServers ?? {})) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const mapped = settingsServerToIMcpServer(name, entry, settings)
    if (mapped) {
      servers.push(mapped)
    }
  }

  servers.sort((a, b) => a.name.localeCompare(b.name))
  return servers
}

async function runCcbMcpManifestProbe(
  configDir: string,
  options?: { test?: boolean; serverName?: string }
): Promise<Record<string, { status?: string; statusMessage?: string; tools?: CcbMcpTestResult['tools'] }>> {
  const cliPath = resolveCcbWandingCliPath()
  if (!cliPath) {
    return {}
  }

  const { spawn } = await import('node:child_process')
  const runtimeArgs = ['--ccb-mcp-manifest']
  if (options?.test) {
    runtimeArgs.push('--test')
  }
  if (options?.serverName) {
    runtimeArgs.push(`--server=${options.serverName}`)
  }

  // CCB dist is bundled for Bun; plain node fails (missing ws, etc.).
  const runtime = 'bun'
  const spawnArgs = [cliPath, ...runtimeArgs]

  return new Promise((resolve) => {
    const PROBE_TIMEOUT_MS = 120_000
    const child = spawn(runtime, spawnArgs, {
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: configDir,
        CCB_WANDING_CONFIG_DIR: configDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      console.warn('[ccbMcpSettings] manifest probe timed out')
      resolve({})
    }, PROBE_TIMEOUT_MS)

    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        console.warn('[ccbMcpSettings] manifest probe failed:', stderr || stdout)
        resolve({})
        return
      }
      try {
        const manifest = JSON.parse(stdout) as {
          servers?: Array<{
            name: string
            status?: string
            statusMessage?: string
            tools?: CcbMcpTestResult['tools']
          }>
        }
        const health: Record<string, { status?: string; statusMessage?: string; tools?: CcbMcpTestResult['tools'] }> =
          {}
        for (const server of manifest.servers ?? []) {
          health[server.name] = {
            status: server.status,
            statusMessage: server.statusMessage,
            tools: server.tools,
          }
        }
        resolve(health)
      } catch (error) {
        console.warn('[ccbMcpSettings] failed to parse manifest JSON:', error)
        resolve({})
      }
    })
  })
}

export async function listCcbMcpServersWithHealth(
  configDir = resolveCcbClaudeConfigDir(),
  options?: { test?: boolean }
): Promise<IMcpServer[]> {
  if (!configDir) {
    return []
  }

  const [settings, health] = await Promise.all([
    readSettingsJson(configDir),
    runCcbMcpManifestProbe(configDir, { test: options?.test }),
  ])

  const servers: IMcpServer[] = []
  for (const [name, entry] of Object.entries(settings.mcpServers ?? {})) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const mapped = settingsServerToIMcpServer(name, entry, settings, health[name])
    if (mapped) {
      servers.push(mapped)
    }
  }

  servers.sort((a, b) => a.name.localeCompare(b.name))
  return servers
}

export async function createCcbMcpServer(
  server: Pick<IMcpServer, 'name' | 'description' | 'transport' | 'original_json' | 'enabled'>
): Promise<IMcpServer> {
  const configDir = resolveCcbClaudeConfigDir()
  if (!configDir) {
    throw new Error('CCB-Wanding config directory not found')
  }

  const entry = mcpServerToSettingsEntry(server as IMcpServer)
  if (!entry) {
    throw new Error('Unsupported MCP transport')
  }

  const settings = await readSettingsJson(configDir)
  const key = server.name.trim()
  if (!key) {
    throw new Error('MCP server name is required')
  }

  if (settings.mcpServers?.[key]) {
    throw new Error(`MCP server "${key}" already exists in CCB-Wanding settings`)
  }

  await backupSettingsJson(configDir)
  const nextSettings: CcbSettingsJson = {
    ...settings,
    mcpServers: { ...(settings.mcpServers ?? {}), [key]: entry },
  }

  if (!server.enabled) {
    const disabled = new Set((nextSettings.disabledMcpjsonServers ?? []).map(normalizeMcpServerName))
    if (!disabled.has(normalizeMcpServerName(key))) {
      nextSettings.disabledMcpjsonServers = [...(nextSettings.disabledMcpjsonServers ?? []), key]
    }
  }

  await writeSettingsJson(configDir, nextSettings)
  const mapped = (await listCcbMcpServers(configDir)).find((item) => item.name === key)
  if (!mapped) {
    throw new Error('Failed to read created MCP server from CCB-Wanding settings')
  }
  return mapped
}

export async function updateCcbMcpServer(
  previousName: string,
  server: Pick<IMcpServer, 'name' | 'description' | 'transport' | 'original_json' | 'enabled'>
): Promise<IMcpServer> {
  const configDir = resolveCcbClaudeConfigDir()
  if (!configDir) {
    throw new Error('CCB-Wanding config directory not found')
  }

  const settings = await readSettingsJson(configDir)
  const existingKey =
    Object.keys(settings.mcpServers ?? {}).find(
      (name) => normalizeMcpServerName(name) === normalizeMcpServerName(previousName)
    ) ?? previousName

  if (!settings.mcpServers?.[existingKey]) {
    throw new Error(`MCP server "${previousName}" not found in CCB-Wanding settings`)
  }

  const entry = mcpServerToSettingsEntry(server as IMcpServer)
  if (!entry) {
    throw new Error('Unsupported MCP transport')
  }

  await backupSettingsJson(configDir)
  const nextMcpServers = { ...(settings.mcpServers ?? {}) }
  if (existingKey !== server.name.trim()) {
    delete nextMcpServers[existingKey]
  }
  nextMcpServers[server.name.trim()] = entry

  const nextSettings: CcbSettingsJson = {
    ...settings,
    mcpServers: nextMcpServers,
    disabledMcpjsonServers: [...(settings.disabledMcpjsonServers ?? [])],
  }

  const normalizedPrevious = normalizeMcpServerName(existingKey)
  const normalizedNext = normalizeMcpServerName(server.name)
  nextSettings.disabledMcpjsonServers = (nextSettings.disabledMcpjsonServers ?? []).filter(
    (name) => normalizeMcpServerName(name) !== normalizedPrevious && normalizeMcpServerName(name) !== normalizedNext
  )
  if (!server.enabled) {
    nextSettings.disabledMcpjsonServers.push(server.name.trim())
  }

  await writeSettingsJson(configDir, nextSettings)
  const mapped = (await listCcbMcpServers(configDir)).find(
    (item) => normalizeMcpServerName(item.name) === normalizedNext
  )
  if (!mapped) {
    throw new Error('Failed to read updated MCP server from CCB-Wanding settings')
  }
  return mapped
}

export async function deleteCcbMcpServer(serverId: string): Promise<void> {
  const configDir = resolveCcbClaudeConfigDir()
  if (!configDir) {
    throw new Error('CCB-Wanding config directory not found')
  }

  const settings = await readSettingsJson(configDir)
  const targetName = serverId.startsWith('ccb-mcp:')
    ? serverId.slice('ccb-mcp:'.length)
    : serverId

  const existingKey = Object.keys(settings.mcpServers ?? {}).find(
    (name) => normalizeMcpServerName(name) === normalizeMcpServerName(targetName)
  )
  if (!existingKey) {
    throw new Error(`MCP server "${serverId}" not found in CCB-Wanding settings`)
  }

  await backupSettingsJson(configDir)
  const nextMcpServers = { ...(settings.mcpServers ?? {}) }
  delete nextMcpServers[existingKey]

  const nextSettings: CcbSettingsJson = {
    ...settings,
    mcpServers: nextMcpServers,
    disabledMcpjsonServers: (settings.disabledMcpjsonServers ?? []).filter(
      (name) => normalizeMcpServerName(name) !== normalizeMcpServerName(existingKey)
    ),
  }

  await writeSettingsJson(configDir, nextSettings)
}

export async function toggleCcbMcpServer(serverId: string): Promise<IMcpServer> {
  const configDir = resolveCcbClaudeConfigDir()
  if (!configDir) {
    throw new Error('CCB-Wanding config directory not found')
  }

  const settings = await readSettingsJson(configDir)
  const targetName = serverId.startsWith('ccb-mcp:')
    ? serverId.slice('ccb-mcp:'.length)
    : serverId

  const existingKey = Object.keys(settings.mcpServers ?? {}).find(
    (name) => normalizeMcpServerName(name) === normalizeMcpServerName(targetName)
  )
  if (!existingKey) {
    throw new Error(`MCP server "${serverId}" not found in CCB-Wanding settings`)
  }

  const currentlyDisabled = isServerDisabled(existingKey, settings)
  await backupSettingsJson(configDir)

  let disabled = [...(settings.disabledMcpjsonServers ?? [])]
  if (currentlyDisabled) {
    disabled = disabled.filter((name) => normalizeMcpServerName(name) !== normalizeMcpServerName(existingKey))
  } else {
    disabled.push(existingKey)
  }

  const nextSettings: CcbSettingsJson = {
    ...settings,
    disabledMcpjsonServers: disabled,
  }
  await writeSettingsJson(configDir, nextSettings)

  const mapped = (await listCcbMcpServers(configDir)).find(
    (item) => normalizeMcpServerName(item.name) === normalizeMcpServerName(existingKey)
  )
  if (!mapped) {
    throw new Error('Failed to read toggled MCP server from CCB-Wanding settings')
  }
  return mapped
}

export async function importCcbMcpServers(
  servers: Array<Pick<IMcpServer, 'name' | 'description' | 'transport' | 'original_json' | 'enabled' | 'builtin'>>
): Promise<IMcpServer[]> {
  const configDir = resolveCcbClaudeConfigDir()
  if (!configDir) {
    throw new Error('CCB-Wanding config directory not found')
  }

  const settings = await readSettingsJson(configDir)
  const { settings: merged, imported } = mergeMcpIntoCcbSettings(
    settings,
    servers.filter((server) => !server.builtin) as IMcpServer[]
  )

  if (imported.length > 0) {
    await backupSettingsJson(configDir)
    await writeSettingsJson(configDir, merged)
  }

  return listCcbMcpServers(configDir)
}

export async function testCcbMcpServer(serverName: string): Promise<CcbMcpTestResult> {
  const configDir = resolveCcbClaudeConfigDir()
  if (!configDir) {
    return { success: false, error: 'CCB-Wanding config directory not found' }
  }

  const health = await runCcbMcpManifestProbe(configDir, { test: true, serverName })
  const result = health[serverName] ?? Object.values(health)[0]
  if (!result) {
    return { success: false, error: 'CCB-Wanding MCP probe returned no data' }
  }

  if (result.status === 'connected') {
    return { success: true, tools: result.tools }
  }
  if (result.status === 'needs-auth') {
    return { success: false, needsAuth: true, error: result.statusMessage ?? 'Needs authentication' }
  }
  return { success: false, error: result.statusMessage ?? 'Connection failed' }
}
