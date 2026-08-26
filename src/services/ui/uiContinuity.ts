export const UI_CONTINUITY_STORAGE_KEY = 'beach-set-manager:ui-continuity:v1';

export const OPERATIONAL_TABS = ['beaches', 'sunbeds', 'aquapark', 'settings'] as const;
export type OperationalTab = (typeof OPERATIONAL_TABS)[number];

export type UiContinuityState = {
  activeTab: OperationalTab;
  scrollPositions: Record<OperationalTab, number>;
};

export type UiContinuityStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function createDefaultUiContinuity(): UiContinuityState {
  return {
    activeTab: 'beaches',
    scrollPositions: {
      beaches: 0,
      sunbeds: 0,
      aquapark: 0,
      settings: 0,
    },
  };
}

function isOperationalTab(value: unknown): value is OperationalTab {
  return typeof value === 'string' && OPERATIONAL_TABS.includes(value as OperationalTab);
}

function safeScrollPosition(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : 0;
}

export function loadUiContinuity(storage: UiContinuityStorage): UiContinuityState {
  const defaults = createDefaultUiContinuity();

  try {
    const raw = storage.getItem(UI_CONTINUITY_STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw) as {
      activeTab?: unknown;
      scrollPositions?: Record<string, unknown>;
    };
    const positions = parsed.scrollPositions;

    return {
      activeTab: isOperationalTab(parsed.activeTab) ? parsed.activeTab : defaults.activeTab,
      scrollPositions: {
        beaches: safeScrollPosition(positions?.beaches),
        sunbeds: safeScrollPosition(positions?.sunbeds),
        aquapark: safeScrollPosition(positions?.aquapark),
        settings: safeScrollPosition(positions?.settings),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveUiContinuity(
  storage: UiContinuityStorage,
  state: UiContinuityState,
): void {
  try {
    storage.setItem(UI_CONTINUITY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // UI continuity is best-effort and never carries operational AppData.
  }
}

export function withScrollPosition(
  state: UiContinuityState,
  tab: OperationalTab,
  scrollY: number,
): UiContinuityState {
  return {
    ...state,
    scrollPositions: {
      ...state.scrollPositions,
      [tab]: safeScrollPosition(scrollY),
    },
  };
}

export function withActiveTab(
  state: UiContinuityState,
  activeTab: OperationalTab,
): UiContinuityState {
  return { ...state, activeTab };
}

export function clampScrollPosition(scrollY: number, maximumScrollY: number): number {
  return Math.min(safeScrollPosition(scrollY), Math.max(0, safeScrollPosition(maximumScrollY)));
}

export function shouldWaitForScrollLayout(
  requestedScrollY: number,
  maximumScrollY: number,
  attemptsRemaining: number,
): boolean {
  return (
    safeScrollPosition(maximumScrollY) < safeScrollPosition(requestedScrollY) &&
    attemptsRemaining > 0
  );
}

export function retainVisibleScrollPosition(
  lastVisibleScrollY: number,
  currentScrollY: number,
  documentIsVisible: boolean,
  restorationPending: boolean,
): number {
  return documentIsVisible && !restorationPending
    ? safeScrollPosition(currentScrollY)
    : safeScrollPosition(lastVisibleScrollY);
}
