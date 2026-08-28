import {
  PETALON_LOCATION_ID,
  type LocationInterfaceProfile,
} from '../../domain/location';

export const LEGACY_UI_CONTINUITY_STORAGE_KEY =
  'beach-set-manager:ui-continuity:v1';
export const UI_CONTINUITY_STORAGE_PREFIX =
  'beach-set-manager:ui-continuity:v2:';
const LEGACY_MIGRATION_STORAGE_KEY =
  'beach-set-manager:ui-continuity:v2:legacy-petalon-owner';

export const OPERATIONAL_TABS = ['beaches', 'sunbeds', 'aquapark', 'settings'] as const;
export type OperationalTab = (typeof OPERATIONAL_TABS)[number];

export type UiContinuityState = {
  activeTab: OperationalTab;
  scrollPositions: Record<OperationalTab, number>;
};

export type UiContinuityStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function getAllowedOperationalTabs(
  profile: LocationInterfaceProfile,
): OperationalTab[] {
  return profile === 'KOVERSADA_AQUAPARK'
    ? ['aquapark', 'settings']
    : [...OPERATIONAL_TABS];
}
export function getDefaultOperationalTab(
  profile: LocationInterfaceProfile,
): OperationalTab {
  return profile === 'KOVERSADA_AQUAPARK' ? 'aquapark' : 'beaches';
}

export function createDefaultUiContinuity(
  defaultTab: OperationalTab = 'beaches',
): UiContinuityState {
  return {
    activeTab: defaultTab,
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

function storageKey(userId: string, locationId: string): string {
  return `${UI_CONTINUITY_STORAGE_PREFIX}${userId}:${locationId}`;
}

function parseContinuity(
  raw: string,
  allowedTabs: OperationalTab[],
  defaultTab: OperationalTab,
): UiContinuityState {
  const defaults = createDefaultUiContinuity(defaultTab);
  const parsed = JSON.parse(raw) as {
    activeTab?: unknown;
    scrollPositions?: Record<string, unknown>;
  };
  const positions = parsed.scrollPositions;
  const parsedTab = isOperationalTab(parsed.activeTab)
    && allowedTabs.includes(parsed.activeTab)
    ? parsed.activeTab
    : defaults.activeTab;

  return {
    activeTab: parsedTab,
    scrollPositions: {
      beaches: safeScrollPosition(positions?.beaches),
      sunbeds: safeScrollPosition(positions?.sunbeds),
      aquapark: safeScrollPosition(positions?.aquapark),
      settings: safeScrollPosition(positions?.settings),
    },
  };
}

export function loadUiContinuity(
  storage: UiContinuityStorage,
  userId: string,
  locationId: string,
  profile: LocationInterfaceProfile,
): UiContinuityState {
  const allowedTabs = getAllowedOperationalTabs(profile);
  const defaultTab = getDefaultOperationalTab(profile);
  try {
    const key = storageKey(userId, locationId);
    const raw = storage.getItem(key);
    if (raw) {
      return parseContinuity(raw, allowedTabs, defaultTab);
    }

    if (
      locationId === PETALON_LOCATION_ID
      && !storage.getItem(LEGACY_MIGRATION_STORAGE_KEY)
    ) {
      const legacy = storage.getItem(LEGACY_UI_CONTINUITY_STORAGE_KEY);
      if (legacy) {
        const migrated = parseContinuity(legacy, allowedTabs, defaultTab);
        storage.setItem(key, JSON.stringify(migrated));
        storage.setItem(LEGACY_MIGRATION_STORAGE_KEY, userId);
        return migrated;
      }
    }
  } catch {
    // Continuity is best-effort and contains no operational AppData.
  }

  return createDefaultUiContinuity(defaultTab);
}

export function saveUiContinuity(
  storage: UiContinuityStorage,
  userId: string,
  locationId: string,
  state: UiContinuityState,
): void {
  try {
    storage.setItem(storageKey(userId, locationId), JSON.stringify(state));
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
    safeScrollPosition(maximumScrollY) < safeScrollPosition(requestedScrollY)
    && attemptsRemaining > 0
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
