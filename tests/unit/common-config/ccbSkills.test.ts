import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  deleteCcbWandingSkill,
  importSkillToCcbWanding,
  listCcbWandingSkills,
} from '@/common/config/ccbSkills';

describe('ccbSkills', () => {
  it('lists, imports, and deletes skills in the CCB-Wanding config dir', async () => {
    const localAppData = await mkdtemp(join(tmpdir(), 'ccb-skills-'));
    const ccbConfigDir = join(localAppData, 'CCB-Wanding', '.claude');
    await mkdir(join(ccbConfigDir, 'skills'), { recursive: true });
    await writeFile(join(ccbConfigDir, 'settings.json'), '{}');
    process.env.LOCALAPPDATA = localAppData;
    delete process.env.CCB_WANDING_CONFIG_DIR;
    delete process.env.CLAUDE_CONFIG_DIR;

    const source = await mkdtemp(join(tmpdir(), 'skill-source-'));
    const sourceSkill = join(source, 'quote-helper');
    await mkdir(sourceSkill);
    await writeFile(
      join(sourceSkill, 'SKILL.md'),
      '---\ndescription: Help with quotation workflows\n---\n\n# Quote helper\n'
    );

    const imported = await importSkillToCcbWanding(source);
    expect(imported.skill_names).toEqual(['quote-helper']);

    const skills = await listCcbWandingSkills();
    expect(skills.map((skill) => [skill.name, skill.description, skill.source])).toEqual([
      ['quote-helper', 'Help with quotation workflows', 'ccb-wanding'],
    ]);
    expect(await readFile(join(ccbConfigDir, 'skills', 'quote-helper', 'SKILL.md'), 'utf8')).toContain(
      'Quote helper'
    );

    await deleteCcbWandingSkill('quote-helper');
    expect(existsSync(join(ccbConfigDir, 'skills', 'quote-helper'))).toBe(false);
  });
});
