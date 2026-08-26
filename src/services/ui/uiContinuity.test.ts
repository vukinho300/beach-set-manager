import { describe, expect, it, vi } from 'vitest';
import {
  UI_CONTINUITY_STORAGE_KEY,
  clampScrollPosition,
  createDefaultUiContinuity,
  loadUiContinuity,
  retainVisibleScrollPosition,
  saveUiContinuity,
  shouldWaitForScrollLayout,
  withActiveTab,
  withScrollPosition,
  type UiContinuityStorage,
} from './uiContinuity';

function memoryStorage(initial: string | null = null): UiContinuityStorage & {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
} {
  let value = initial;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
  };
}

describe('UI continuity', () => {
  it('persists only active tab and per-tab scroll positions under a separate UI key', () => {
    const storage = memoryStorage();
    let state = createDefaultUiContinuity();
    state = withScrollPosition(state, 'beaches', 1840.4);
    state = withScrollPosition(state, 'aquapark', 620);
    state = withActiveTab(state, 'aquapark');

    saveUiContinuity(storage, state);

    expect(storage.setItem).toHaveBeenCalledWith(
      UI_CONTINUITY_STORAGE_KEY,
      JSON.stringify({
        activeTab: 'aquapark',
        scrollPositions: {
          beaches: 1840,
          sunbeds: 0,
          aquapark: 620,
          settings: 0,
        },
      }),
    );
    expect(loadUiContinuity(storage)).toEqual(state);
    expect(JSON.stringify(state)).not.toContain('sets');
    expect(JSON.stringify(state)).not.toContain('transactions');
  });

  it('fails safely for malformed tabs, scroll values, JSON, and storage errors', () => {
    const malformed = memoryStorage(JSON.stringify({
      activeTab: 'admin',
      scrollPositions: {
        beaches: -50,
        sunbeds: 'far',
        aquapark: Number.POSITIVE_INFINITY,
        settings: 120.6,
      },
    }));

    expect(loadUiContinuity(malformed)).toEqual({
      activeTab: 'beaches',
      scrollPositions: {
        beaches: 0,
        sunbeds: 0,
        aquapark: 0,
        settings: 121,
      },
    });
    expect(loadUiContinuity(memoryStorage('{not-json'))).toEqual(
      createDefaultUiContinuity(),
    );
    expect(loadUiContinuity({
      getItem: () => {
        throw new Error('storage denied');
      },
      setItem: () => undefined,
    })).toEqual(createDefaultUiContinuity());
  });

  it('clamps restored scroll positions to the current layout safely', () => {
    expect(clampScrollPosition(1800, 2400)).toBe(1800);
    expect(clampScrollPosition(1800, 900)).toBe(900);
    expect(clampScrollPosition(-10, 900)).toBe(0);
    expect(clampScrollPosition(100, -1)).toBe(0);
  });

  it('waits for the full tab layout before clamping a cold-start scroll position', () => {
    expect(shouldWaitForScrollLayout(1800, 0, 120)).toBe(true);
    expect(shouldWaitForScrollLayout(1800, 1700, 1)).toBe(true);
    expect(shouldWaitForScrollLayout(1800, 1800, 120)).toBe(false);
    expect(shouldWaitForScrollLayout(1800, 900, 0)).toBe(false);
  });

  it('does not replace the last visible position with Safari tab-teardown scroll zero', () => {
    expect(retainVisibleScrollPosition(1840, 0, false, false)).toBe(1840);
    expect(retainVisibleScrollPosition(1840, 0, true, true)).toBe(1840);
    expect(retainVisibleScrollPosition(1840, 920, true, false)).toBe(920);
  });
});
