import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { httpRequestMock } = vi.hoisted(() => ({
  httpRequestMock: vi.fn(),
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  httpRequest: httpRequestMock,
}));

import {
  AIONUI_MANAGED_SKILL_MARKER,
  mergeAionUiCorpusSkillRecords,
} from '@/common/config/ccbSkillsSyncShared';
import {
  listCcbWandingSkills,
  syncAionUiCorpusSkillsToCcbWanding,
} from '@/common/config/ccbSkills';

describe('ccbSkillsSyncShared', () => {
  it('merges auto-inject and builtin opt-in corpus skills', () => {
    const merged = mergeAionUiCorpusSkillRecords(
      [{ name: 'officecli', location: 'C:\\corpus\\auto-inject\\office-cli' }],
      [
        { name: 'mermaid', location: 'C:\\corpus\\mermaid', source: 'builtin' },
        { name: 'ignored-ext', location: 'C:\\ext\\skill', source: 'extension' },
        { name: 'ignored-custom', location: 'C:\\custom\\skill', source: 'custom' },
        { name: 'officecli', location: 'C:\\corpus\\duplicate', source: 'builtin' },
      ]
    );

    expect(merged).toEqual([
      { name: 'mermaid', location: 'C:\\corpus\\mermaid' },
      { name: 'officecli', location: 'C:\\corpus\\auto-inject\\office-cli' },
    ]);
  });
});

describe('syncAionUiCorpusSkillsToCcbWanding', () => {
  let previousLocalAppData: string | undefined;

  beforeEach(() => {
    httpRequestMock.mockReset();
    previousLocalAppData = process.env.LOCALAPPDATA;
    delete process.env.CCB_WANDING_CONFIG_DIR;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    if (previousLocalAppData === undefined) {
      delete process.env.LOCALAPPDATA;
    } else {
      process.env.LOCALAPPDATA = previousLocalAppData;
    }
    delete process.env.CCB_WANDING_CONFIG_DIR;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  it('copies corpus skills into CCB-Wanding skills dir with managed marker', async () => {
    const localAppData = await mkdtemp(join(tmpdir(), 'ccb-sync-'));
    const ccbConfigDir = join(localAppData, 'CCB-Wanding', '.claude');
    await mkdir(join(ccbConfigDir, 'skills'), { recursive: true });
    await writeFile(join(ccbConfigDir, 'settings.json'), '{}');

    const corpusRoot = await mkdtemp(join(tmpdir(), 'aionui-corpus-'));
    const cronSkill = join(corpusRoot, 'cron');
    await mkdir(cronSkill);
    await writeFile(join(cronSkill, 'SKILL.md'), '---\ndescription: Cron helper\n---\n\n# Cron\n');

    httpRequestMock.mockImplementation(async (method: string, path: string) => {
      if (method === 'GET' && path === '/api/skills/builtin-auto') {
        return [{ name: 'cron', location: cronSkill }];
      }
      if (method === 'GET' && path === '/api/skills') {
        return [{ name: 'cron', location: cronSkill, source: 'builtin' }];
      }
      return [];
    });

    process.env.LOCALAPPDATA = localAppData;

    const result = await syncAionUiCorpusSkillsToCcbWanding();
    expect(result.copied).toEqual(['cron']);
    expect(result.errors).toEqual([]);
    expect(existsSync(join(ccbConfigDir, 'skills', 'cron', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(ccbConfigDir, 'skills', 'cron', AIONUI_MANAGED_SKILL_MARKER))).toBe(true);

    const skills = await listCcbWandingSkills();
    expect(skills.map((skill) => [skill.name, skill.source])).toEqual([['cron', 'builtin']]);
    expect(await readFile(join(ccbConfigDir, 'skills', 'cron', 'SKILL.md'), 'utf8')).toContain('# Cron');
  });

  it('skips user-owned skills that already exist without managed marker', async () => {
    const localAppData = await mkdtemp(join(tmpdir(), 'ccb-sync-user-'));
    const ccbConfigDir = join(localAppData, 'CCB-Wanding', '.claude');
    const userSkillDir = join(ccbConfigDir, 'skills', 'cron');
    await mkdir(userSkillDir, { recursive: true });
    await writeFile(join(userSkillDir, 'SKILL.md'), '# User edited cron\n');
    await writeFile(join(ccbConfigDir, 'settings.json'), '{}');

    const corpusRoot = await mkdtemp(join(tmpdir(), 'aionui-corpus-user-'));
    const corpusSkill = join(corpusRoot, 'cron');
    await mkdir(corpusSkill);
    await writeFile(join(corpusSkill, 'SKILL.md'), '---\ndescription: Corpus cron\n---\n\n# Corpus\n');

    httpRequestMock.mockImplementation(async (method: string, path: string) => {
      if (method === 'GET' && path === '/api/skills/builtin-auto') {
        return [{ name: 'cron', location: corpusSkill }];
      }
      if (method === 'GET' && path === '/api/skills') {
        return [{ name: 'cron', location: corpusSkill, source: 'builtin' }];
      }
      return [];
    });

    process.env.LOCALAPPDATA = localAppData;

    const result = await syncAionUiCorpusSkillsToCcbWanding();
    expect(result.skipped_existing).toEqual(['cron']);
    expect(await readFile(join(userSkillDir, 'SKILL.md'), 'utf8')).toContain('User edited cron');
  });
});
