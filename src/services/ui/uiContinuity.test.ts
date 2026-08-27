import { describe, expect, it, vi } from 'vitest';
import {
  LEGACY_UI_CONTINUITY_STORAGE_KEY,
  UI_CONTINUITY_STORAGE_PREFIX,
  clampScrollPosition,
  createDefaultUiContinuity,
  getAllowedOperationalTabs,
  loadUiContinuity,
  retainVisibleScrollPosition,
  saveUiContinuity,
  shouldWaitForScrollLayout,
  withActiveTab,
  withScrollPosition,
  type UiContinuityStorage,
} from './uiContinuity';

function memoryStorage(initial: Record<string, string> = {}): UiContinuityStorage & {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
} {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe('user + location UI continuity', () => {
  it('persists only active tab and scroll positions under user + location identity', () => {
    const storage = memoryStorage();
    let state = createDefaultUiContinuity();
    state = withScrollPosition(state, 'beaches', 1840.4);
    state = withScrollPosition(state, 'aquapark', 620);
    state = withActiveTab(state, 'aquapark');

    saveUiContinuity(storage, 'mark', 'petalon', state);

    expect(storage.setItem).toHaveBeenCalledWith(
      `${UI_CONTINUITY_STORAGE_PREFIX}mark:petalon`,
      JSON.stringify(state),
    );
    expect(loadUiContinuity(
      storage,
      'mark',
      'petalon',
      'PETALON_FULL',
    )).toEqual(state);
    expect(JSON.stringify(state)).not.toContain('transactions');
  });

  it('does not transfer Petalon tab or scroll continuity into Koversada', () => {
    const petalon = withScrollPosition(
      withActiveTab(createDefaultUiContinuity(), 'beaches'),
      'beaches',
      1840,
    );
    const storage = memoryStorage({
      [`${UI_CONTINUITY_STORAGE_PREFIX}mark:petalon`]: JSON.stringify(petalon),
    });

    expect(loadUiContinuity(
      storage,
      'mark',
      'koversada',
      'KOVERSADA_AQUAPARK',
    )).toEqual(createDefaultUiContinuity('aquapark'));
  });

  it('does not expose one account continuity to another account', () => {
    const storage = memoryStorage({
      [`${UI_CONTINUITY_STORAGE_PREFIX}vuk:petalon`]: JSON.stringify(
        withActiveTab(createDefaultUiContinuity(), 'settings'),
      ),
    });

    expect(loadUiContinuity(
      storage,
      'vito',
      'petalon',
      'PETALON_FULL',
    )).toEqual(createDefaultUiContinuity());
  });

  it('migrates the legacy continuity once as Petalon continuity', () => {
    const legacy = withActiveTab(createDefaultUiContinuity(), 'sunbeds');
    const storage = memoryStorage({
      [LEGACY_UI_CONTINUITY_STORAGE_KEY]: JSON.stringify(legacy),
    });

    expect(loadUiContinuity(
      storage,
      'vuk',
      '00000000-0000-4000-8000-000000000001',
      'PETALON_FULL',
    )).toEqual(legacy);
    expect(storage.setItem).toHaveBeenCalledWith(
      `${UI_CONTINUITY_STORAGE_PREFIX}vuk:00000000-0000-4000-8000-000000000001`,
      JSON.stringify(legacy),
    );
  });

  it('rejects hidden Petalon tabs under the Koversada profile', () => {
    const storage = memoryStorage({
      [`${UI_CONTINUITY_STORAGE_PREFIX}worker:koversada`]: JSON.stringify({
        activeTab: 'beaches',
        scrollPositions: { beaches: 800, sunbeds: 0, aquapark: 40, settings: 0 },
      }),
    });

    expect(getAllowedOperationalTabs('KOVERSADA_AQUAPARK')).toEqual([
      'aquapark',
      'settings',
    ]);
    expect(loadUiContinuity(
      storage,
      'worker',
      'koversada',
      'KOVERSADA_AQUAPARK',
    ).activeTab).toBe('aquapark');
  });

  it('fails safely for malformed values and storage errors', () => {
    const malformed = memoryStorage({
      [`${UI_CONTINUITY_STORAGE_PREFIX}vito:petalon`]: JSON.stringify({
        activeTab: 'admin',
        scrollPositions: {
          beaches: -50,
          sunbeds: 'far',
          aquapark: Number.POSITIVE_INFINITY,
          settings: 120.6,
        },
      }),
    });
    expect(loadUiContinuity(
      malformed,
      'vito',
      'petalon',
      'PETALON_FULL',
    )).toEqual({
      activeTab: 'beaches',
      scrollPositions: { beaches: 0, sunbeds: 0, aquapark: 0, settings: 121 },
    });
    expect(loadUiContinuity({
      getItem: () => { throw new Error('storage denied'); },
      setItem: () => undefined,
    }, 'vito', 'petalon', 'PETALON_FULL')).toEqual(createDefaultUiContinuity());
  });

  it('clamps and retains scroll positions safely through PWA lifecycle', () => {
    expect(clampScrollPosition(1800, 2400)).toBe(1800);
    expect(clampScrollPosition(1800, 900)).toBe(900);
    expect(clampScrollPosition(-10, 900)).toBe(0);
    expect(shouldWaitForScrollLayout(1800, 0, 120)).toBe(true);
    expect(shouldWaitForScrollLayout(1800, 900, 0)).toBe(false);
    expect(retainVisibleScrollPosition(1840, 0, false, false)).toBe(1840);
    expect(retainVisibleScrollPosition(1840, 920, true, false)).toBe(920);
  });
});
