import { afterEach, describe, expect, it } from 'vitest';
import { listCcbWandingCliCandidates } from '../../../packages/desktop/src/common/config/ccbWandingRuntimeNode';

describe('listCcbWandingCliCandidates (WANd.INSTALL.RESOLVE.001)', () => {
  const prev = {
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    CCB_WANDING_CLI: process.env.CCB_WANDING_CLI,
    CCB_WANDING_CLI_PATH: process.env.CCB_WANDING_CLI_PATH,
    CCB_WANDING_INSTALL_DIR: process.env.CCB_WANDING_INSTALL_DIR,
    CCB_INSTALL_DIR: process.env.CCB_INSTALL_DIR,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('lists Programs\\CCB-Wanding before legacy LOCALAPPDATA\\CCB-Wanding and D:\\CCB-Wanding', () => {
    process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';
    delete process.env.CCB_WANDING_CLI;
    delete process.env.CCB_WANDING_CLI_PATH;
    delete process.env.CCB_WANDING_INSTALL_DIR;
    delete process.env.CCB_INSTALL_DIR;

    const list = listCcbWandingCliCandidates().map((p) => p.replace(/\//g, '\\').toLowerCase());
    const programs = list.findIndex((p) => p.includes('\\programs\\ccb-wanding\\dist\\cli'));
    // Mistyped tree next to .claude — must lose to Programs (registry may still precede both).
    const legacyLocal = list.findIndex(
      (p) => p.includes('\\appdata\\local\\ccb-wanding\\dist\\cli') && !p.includes('\\programs\\'),
    );

    expect(programs, 'Programs path must be listed').toBeGreaterThanOrEqual(0);
    expect(legacyLocal, 'legacy LOCALAPPDATA\\CCB-Wanding must still be listed').toBeGreaterThanOrEqual(0);
    expect(programs).toBeLessThan(legacyLocal);
    expect(
      list.some((p) => p.includes('d:\\ccb-wanding\\dist\\cli')),
      'D:\\CCB-Wanding must still be listed (residue or registry)',
    ).toBe(true);
  });

  it('prefers CCB_WANDING_INSTALL_DIR ahead of Programs when set', () => {
    process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';
    process.env.CCB_WANDING_INSTALL_DIR = 'E:\\Custom-Keep';
    delete process.env.CCB_WANDING_CLI;

    const list = listCcbWandingCliCandidates().map((p) => p.replace(/\//g, '\\').toLowerCase());
    const custom = list.findIndex((p) => p.includes('e:\\custom-keep\\dist\\cli'));
    const programs = list.findIndex((p) => p.includes('\\programs\\ccb-wanding\\dist\\cli'));
    expect(custom).toBeGreaterThanOrEqual(0);
    expect(programs).toBeGreaterThanOrEqual(0);
    expect(custom).toBeLessThan(programs);
  });
});
