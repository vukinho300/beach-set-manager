import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import './App.css';

type SetStatus = 'free' | 'paid' | 'reserved' | 'partial';
type BedStatus = Exclude<SetStatus, 'partial'>;
type BeachId = 1 | 2;
type BedId = 1 | 2 | 3 | 4;
type BedLabel = `Bed ${BedId}`;
type ReservationSurname = string;
type TabId = 'beach1' | 'beach2' | 'beds' | 'aquapark';

type BeachSet = {
  id: number;
  beach: BeachId;
  status: SetStatus;
  beachReservationId?: string;
  surname?: string;
  reservedDays?: number;
  partialNote?: string;
  updatedAt?: string;
};

type ExtraBed = {
  id: BedId;
  label: BedLabel;
  status: BedStatus;
  beachReservationId?: string;
  surname?: string;
  reservedDays?: number;
  updatedAt?: string;
};

type BeachReservation = {
  id: string;
  surname: string;
  reservedDays: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

type BeachReservationDetails = {
  surname: string;
  reservedDays: number;
  notes?: string;
};

type AquaparkReservation = {
  id: string;
  surname: string;
  reservedDays: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

type BeachSetMap = Record<number, BeachSet>;
type ExtraBedMap = Record<BedId, ExtraBed>;
type DetailMode = 'actions' | 'reserved' | 'partial';
type ActiveEditor =
  | { kind: 'set'; id: number }
  | { kind: 'bed'; id: BedId }
  | { kind: 'beachReservation'; id: string }
  | { kind: 'aquapark'; id?: string };
type ActiveReservationSummary = {
  id: string;
  surname: string;
  reservedDays: number;
  notes?: string;
  assignmentLabel: string;
};
type BeachAssignment = {
  kind: 'set' | 'bed';
  id: number;
  label: string;
};
type AppData = {
  sets: BeachSetMap;
  extraBeds: ExtraBedMap;
  beachReservations: BeachReservation[];
  savedSurnames: ReservationSurname[];
  aquaparkReservations: AquaparkReservation[];
  lastAutomaticResetDate?: string;
};
type BackupPayload = AppData & {
  app: 'Beach Set Manager';
  version: 6;
  exportedAt: string;
};

const TOTAL_SETS = 56;
const STORAGE_KEY = 'sunbed-beach-manager:v5';
const LEGACY_STORAGE_KEY = 'sunbed-beach-manager:v4';
const OLDER_STORAGE_KEY = 'sunbed-beach-manager:v3';
const OLD_STORAGE_KEY = 'sunbed-beach-manager:v2';
const OLDEST_STORAGE_KEY = 'sunbed-beach-manager:v1';
const APP_STORAGE_KEYS = [STORAGE_KEY, LEGACY_STORAGE_KEY, OLDER_STORAGE_KEY, OLD_STORAGE_KEY, OLDEST_STORAGE_KEY];
const STATUS_ORDER: SetStatus[] = ['free', 'paid', 'reserved', 'partial'];
const BED_STATUS_ORDER: BedStatus[] = ['free', 'paid', 'reserved'];
const BEACH_ONE_UPPER_ROW = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
const BEACH_ONE_LOWER_ROW = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const EXTRA_BED_IDS: BedId[] = [1, 2, 3, 4];
const PARTIAL_OPTIONS = ['1 sunbed only', '1 sunbed + parasol', '2 sunbeds no parasol'];

const STATUS_META: Record<SetStatus, { label: string; shortLabel: string }> = {
  free: { label: 'Free', shortLabel: 'Free' },
  paid: { label: 'Paid', shortLabel: 'Paid' },
  reserved: { label: 'Reserved', shortLabel: 'Reserved' },
  partial: { label: 'Partial', shortLabel: 'Partial' },
};

function getBeachForSet(id: number): BeachId {
  return id <= 20 ? 1 : 2;
}

function createBeachSet(id: number, status: SetStatus = 'free'): BeachSet {
  return {
    id,
    beach: getBeachForSet(id),
    status,
  };
}

function createExtraBed(id: BedId, status: BedStatus = 'free'): ExtraBed {
  return {
    id,
    label: `Bed ${id}`,
    status,
  };
}

function createFreeBeachSets(): BeachSetMap {
  return Object.fromEntries(
    Array.from({ length: TOTAL_SETS }, (_, index) => {
      const id = index + 1;
      return [id, createBeachSet(id)];
    }),
  ) as BeachSetMap;
}

function createFreeExtraBeds(): ExtraBedMap {
  return Object.fromEntries(EXTRA_BED_IDS.map((id) => [id, createExtraBed(id)])) as ExtraBedMap;
}

function createFreeAppData(): AppData {
  return {
    sets: createFreeBeachSets(),
    extraBeds: createFreeExtraBeds(),
    beachReservations: [],
    savedSurnames: [],
    aquaparkReservations: [],
    lastAutomaticResetDate: getLocalDateKey(),
  };
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeResetDate(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function createReservationId(prefix: string): string {
  const now = new Date().toISOString();

  return typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${prefix}-${now}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSurname(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function getSurnameKey(value: string): string {
  return normalizeSurname(value).toLocaleLowerCase();
}

function upsertSavedSurname(currentSurnames: ReservationSurname[], surname: string): ReservationSurname[] {
  const normalized = normalizeSurname(surname);

  if (!normalized) {
    return currentSurnames;
  }

  const existingIndex = currentSurnames.findIndex((savedSurname) => getSurnameKey(savedSurname) === getSurnameKey(normalized));

  if (existingIndex === -1) {
    return [...currentSurnames, normalized].sort((first, second) => first.localeCompare(second));
  }

  const existing = currentSurnames[existingIndex];
  const shouldImproveCapitalization =
    existing === existing.toLocaleLowerCase() && normalized !== normalized.toLocaleLowerCase();

  if (!shouldImproveCapitalization) {
    return currentSurnames;
  }

  return currentSurnames.map((savedSurname, index) => (index === existingIndex ? normalized : savedSurname));
}

function normalizeSavedSurnames(value: unknown): ReservationSurname[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<ReservationSurname[]>((savedSurnames, rawSurname) => {
    return typeof rawSurname === 'string' ? upsertSavedSurname(savedSurnames, rawSurname) : savedSurnames;
  }, []);
}

function createBeachReservation(details: BeachReservationDetails): BeachReservation {
  const now = new Date().toISOString();

  return {
    id: createReservationId('beach'),
    surname: normalizeSurname(details.surname),
    reservedDays: Math.max(1, Math.floor(details.reservedDays) || 1),
    notes: details.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function isSetStatus(value: unknown): value is SetStatus {
  return typeof value === 'string' && STATUS_ORDER.includes(value as SetStatus);
}

function isBedStatus(value: unknown): value is BedStatus {
  return typeof value === 'string' && BED_STATUS_ORDER.includes(value as BedStatus);
}

function isBeachSet(value: unknown, id: number): value is BeachSet {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BeachSet>;
  return candidate.id === id && isSetStatus(candidate.status);
}

function isExtraBed(value: unknown, id: BedId): value is ExtraBed {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ExtraBed>;
  return candidate.id === id && isBedStatus(candidate.status);
}

function normalizeSet(value: unknown, id: number): BeachSet {
  if (!isBeachSet(value, id)) {
    return createBeachSet(id);
  }

  return {
    id,
    beach: getBeachForSet(id),
    status: value.status,
    beachReservationId: value.beachReservationId,
    surname: value.surname,
    reservedDays: value.reservedDays,
    partialNote: value.partialNote,
    updatedAt: value.updatedAt,
  };
}

function normalizeImportedSet(value: unknown, id: number): BeachSet | null {
  if (!isBeachSet(value, id)) {
    return null;
  }

  const surname = typeof value.surname === 'string' ? value.surname.trim() : undefined;
  const beachReservationId =
    typeof value.beachReservationId === 'string' && value.beachReservationId.trim()
      ? value.beachReservationId
      : undefined;
  const partialNote = typeof value.partialNote === 'string' ? value.partialNote.trim() : undefined;
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : undefined;
  const reservedDays =
    typeof value.reservedDays === 'number' && Number.isFinite(value.reservedDays)
      ? Math.max(1, Math.floor(value.reservedDays))
      : undefined;

  return {
    id,
    beach: getBeachForSet(id),
    status: value.status,
    beachReservationId,
    surname: surname || undefined,
    reservedDays,
    partialNote: partialNote || undefined,
    updatedAt,
  };
}

function normalizeBed(value: unknown, id: BedId): ExtraBed {
  if (!isExtraBed(value, id)) {
    return createExtraBed(id);
  }

  return {
    id,
    label: `Bed ${id}`,
    status: value.status,
    beachReservationId: value.beachReservationId,
    surname: value.surname,
    reservedDays: value.reservedDays,
    updatedAt: value.updatedAt,
  };
}

function normalizeImportedBed(value: unknown, id: BedId): ExtraBed | null {
  if (!isExtraBed(value, id)) {
    return null;
  }

  const surname = typeof value.surname === 'string' ? value.surname.trim() : undefined;
  const beachReservationId =
    typeof value.beachReservationId === 'string' && value.beachReservationId.trim()
      ? value.beachReservationId
      : undefined;
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : undefined;
  const reservedDays =
    typeof value.reservedDays === 'number' && Number.isFinite(value.reservedDays)
      ? Math.max(1, Math.floor(value.reservedDays))
      : undefined;

  return {
    id,
    label: `Bed ${id}`,
    status: value.status,
    beachReservationId,
    surname: surname || undefined,
    reservedDays,
    updatedAt,
  };
}

function normalizeImportedBeachReservation(value: unknown): BeachReservation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<BeachReservation>;
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : undefined;
  const surname = typeof candidate.surname === 'string' ? normalizeSurname(candidate.surname) : '';
  const reservedDays =
    typeof candidate.reservedDays === 'number' && Number.isFinite(candidate.reservedDays)
      ? Math.max(1, Math.floor(candidate.reservedDays))
      : undefined;
  const notes = typeof candidate.notes === 'string' ? candidate.notes.trim() : undefined;
  const createdAt =
    typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
      ? candidate.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim() ? candidate.updatedAt : undefined;

  if (!id || !surname || !reservedDays) {
    return null;
  }

  return {
    id,
    surname,
    reservedDays,
    notes: notes || undefined,
    createdAt,
    updatedAt,
  };
}

function parseBeachReservations(value: unknown): BeachReservation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<BeachReservation[]>((reservations, rawReservation) => {
    const reservation = normalizeImportedBeachReservation(rawReservation);

    if (!reservation || reservations.some((existing) => existing.id === reservation.id)) {
      return reservations;
    }

    return [...reservations, reservation];
  }, []);
}

function createAquaparkReservation(details: {
  surname: string;
  reservedDays: number;
  notes?: string;
}): AquaparkReservation {
  const now = new Date().toISOString();

  return {
    id: createReservationId('aquapark'),
    surname: normalizeSurname(details.surname),
    reservedDays: Math.max(1, Math.floor(details.reservedDays) || 1),
    notes: details.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeImportedAquaparkReservation(value: unknown): AquaparkReservation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AquaparkReservation>;
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : undefined;
  const surname = typeof candidate.surname === 'string' ? normalizeSurname(candidate.surname) : '';
  const reservedDays =
    typeof candidate.reservedDays === 'number' && Number.isFinite(candidate.reservedDays)
      ? Math.max(1, Math.floor(candidate.reservedDays))
      : undefined;
  const createdAt =
    typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
      ? candidate.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim() ? candidate.updatedAt : undefined;
  const notes = typeof candidate.notes === 'string' ? candidate.notes.trim() : undefined;

  if (!id || !surname || !reservedDays) {
    return null;
  }

  return {
    id,
    surname,
    reservedDays,
    notes: notes || undefined,
    createdAt,
    updatedAt,
  };
}

function parseAquaparkReservations(value: unknown): AquaparkReservation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<AquaparkReservation[]>((reservations, rawReservation) => {
    const reservation = normalizeImportedAquaparkReservation(rawReservation);
    return reservation ? [...reservations, reservation] : reservations;
  }, []);
}

function parseSets(value: unknown, allowMissingAsFree = false): BeachSetMap | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawSets = value as Record<string, unknown>;
  const entries = Array.from({ length: TOTAL_SETS }, (_, index) => {
    const id = index + 1;
    const rawSet = rawSets[String(id)];
    const normalizedSet = rawSet
      ? normalizeImportedSet(rawSet, id)
      : allowMissingAsFree
        ? createBeachSet(id)
        : null;

    if (!normalizedSet) {
      return null;
    }

    return [id, normalizedSet] as const;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(entries as Array<readonly [number, BeachSet]>) as BeachSetMap;
}

function parseExtraBeds(value: unknown, allowMissingAsFree = false): ExtraBedMap | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawBeds = value as Record<string, unknown>;
  const entries = EXTRA_BED_IDS.map((id) => {
    const rawBed = rawBeds[String(id)];
    const normalizedBed = rawBed
      ? normalizeImportedBed(rawBed, id)
      : allowMissingAsFree
        ? createExtraBed(id)
        : null;

    if (!normalizedBed) {
      return null;
    }

    return [id, normalizedBed] as const;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(entries as Array<readonly [BedId, ExtraBed]>) as ExtraBedMap;
}

function migrateLegacyBeachReservations(
  sets: BeachSetMap,
  extraBeds: ExtraBedMap,
  existingReservations: BeachReservation[],
): Pick<AppData, 'sets' | 'extraBeds' | 'beachReservations'> {
  let beachReservations = [...existingReservations];
  const reservationIds = new Set(beachReservations.map((reservation) => reservation.id));

  function getOrCreateReservation(surname: string, reservedDays: number): BeachReservation {
    const normalizedSurname = normalizeSurname(surname);
    const existing = beachReservations.find(
      (reservation) =>
        getSurnameKey(reservation.surname) === getSurnameKey(normalizedSurname) &&
        reservation.reservedDays === reservedDays,
    );

    if (existing) {
      return existing;
    }

    const reservation = createBeachReservation({ surname: normalizedSurname, reservedDays });
    beachReservations = [...beachReservations, reservation];
    reservationIds.add(reservation.id);
    return reservation;
  }

  const migratedSets = Object.fromEntries(
    Object.values(sets).map((set) => {
      if (set.status !== 'reserved') {
        return [set.id, set];
      }

      if (set.beachReservationId && reservationIds.has(set.beachReservationId)) {
        return [set.id, set];
      }

      if (!set.surname || !set.reservedDays || set.reservedDays < 1) {
        return [set.id, set];
      }

      const reservation = getOrCreateReservation(set.surname, set.reservedDays);
      return [
        set.id,
        {
          ...set,
          beachReservationId: reservation.id,
        },
      ];
    }),
  ) as BeachSetMap;

  const migratedBeds = Object.fromEntries(
    Object.values(extraBeds).map((bed) => {
      if (bed.status !== 'reserved') {
        return [bed.id, bed];
      }

      if (bed.beachReservationId && reservationIds.has(bed.beachReservationId)) {
        return [bed.id, bed];
      }

      if (!bed.surname || !bed.reservedDays || bed.reservedDays < 1) {
        return [bed.id, bed];
      }

      const reservation = getOrCreateReservation(bed.surname, bed.reservedDays);
      return [
        bed.id,
        {
          ...bed,
          beachReservationId: reservation.id,
        },
      ];
    }),
  ) as ExtraBedMap;

  return {
    sets: migratedSets,
    extraBeds: migratedBeds,
    beachReservations,
  };
}

function parseImportedAppData(value: unknown): AppData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<BackupPayload> & {
    sets?: unknown;
    extraBeds?: unknown;
    beachReservations?: unknown;
    savedSurnames?: unknown;
    aquaparkReservations?: unknown;
  };
  const sets = payload.sets ? parseSets(payload.sets) : parseSets(value);

  if (!sets) {
    return null;
  }

  const extraBeds = payload.extraBeds ? parseExtraBeds(payload.extraBeds) : createFreeExtraBeds();

  if (!extraBeds) {
    return null;
  }

  const migratedBeachData = migrateLegacyBeachReservations(
    sets,
    extraBeds,
    parseBeachReservations(payload.beachReservations),
  );

  return {
    sets: migratedBeachData.sets,
    extraBeds: migratedBeachData.extraBeds,
    beachReservations: migratedBeachData.beachReservations,
    savedSurnames: normalizeSavedSurnames(payload.savedSurnames),
    aquaparkReservations: parseAquaparkReservations(payload.aquaparkReservations),
    lastAutomaticResetDate: normalizeResetDate(payload.lastAutomaticResetDate),
  };
}

function loadLegacyStatuses(): BeachSetMap | null {
  const saved = window.localStorage.getItem(OLDEST_STORAGE_KEY);

  if (!saved) {
    return null;
  }

  const parsed = JSON.parse(saved) as Partial<Record<string, unknown>>;

  return Object.fromEntries(
    Array.from({ length: TOTAL_SETS }, (_, index) => {
      const id = index + 1;
      const status = parsed[String(id)];
      return [id, createBeachSet(id, isSetStatus(status) ? status : 'free')];
    }),
  ) as BeachSetMap;
}

function loadSavedAppData(): AppData {
  const defaults = createFreeAppData();

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved) as {
        sets?: unknown;
        extraBeds?: unknown;
        beachReservations?: unknown;
        savedSurnames?: unknown;
        aquaparkReservations?: unknown;
        lastAutomaticResetDate?: unknown;
      };
      const sets = parseSets(parsed.sets, true);
      const extraBeds = parsed.extraBeds ? parseExtraBeds(parsed.extraBeds, true) : createFreeExtraBeds();

      if (sets && extraBeds) {
        const migratedBeachData = migrateLegacyBeachReservations(
          sets,
          extraBeds,
          parseBeachReservations(parsed.beachReservations),
        );

        return {
          sets: migratedBeachData.sets,
          extraBeds: migratedBeachData.extraBeds,
          beachReservations: migratedBeachData.beachReservations,
          savedSurnames: normalizeSavedSurnames(parsed.savedSurnames),
          aquaparkReservations: parseAquaparkReservations(parsed.aquaparkReservations),
          lastAutomaticResetDate: normalizeResetDate(parsed.lastAutomaticResetDate),
        };
      }
    }

    const legacySaved = window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacySaved) {
      const parsed = JSON.parse(legacySaved) as {
        sets?: unknown;
        extraBeds?: unknown;
        beachReservations?: unknown;
        savedSurnames?: unknown;
        aquaparkReservations?: unknown;
      };
      const legacySets = parsed.sets ? parseSets(parsed.sets, true) : parseSets(parsed, true);
      const legacyExtraBeds = parsed.extraBeds ? parseExtraBeds(parsed.extraBeds, true) : createFreeExtraBeds();

      if (legacySets && legacyExtraBeds) {
        const migratedBeachData = migrateLegacyBeachReservations(
          legacySets,
          legacyExtraBeds,
          parseBeachReservations(parsed.beachReservations),
        );

        return {
          sets: migratedBeachData.sets,
          extraBeds: migratedBeachData.extraBeds,
          beachReservations: migratedBeachData.beachReservations,
          savedSurnames: normalizeSavedSurnames(parsed.savedSurnames),
          aquaparkReservations: parseAquaparkReservations(parsed.aquaparkReservations),
        };
      }
    }

    const olderSaved = window.localStorage.getItem(OLDER_STORAGE_KEY);

    if (olderSaved) {
      const parsed = JSON.parse(olderSaved) as { sets?: unknown; extraBeds?: unknown };
      const olderSets = parsed.sets ? parseSets(parsed.sets, true) : parseSets(parsed, true);
      const olderExtraBeds = parsed.extraBeds ? parseExtraBeds(parsed.extraBeds, true) : createFreeExtraBeds();

      if (olderSets && olderExtraBeds) {
        const migratedBeachData = migrateLegacyBeachReservations(
          olderSets,
          olderExtraBeds,
          [],
        );

        return {
          sets: migratedBeachData.sets,
          extraBeds: migratedBeachData.extraBeds,
          beachReservations: migratedBeachData.beachReservations,
          savedSurnames: [],
          aquaparkReservations: [],
        };
      }
    }

    const oldSaved = window.localStorage.getItem(OLD_STORAGE_KEY);

    if (oldSaved) {
      const oldSets = parseSets(JSON.parse(oldSaved), true);

      if (oldSets) {
        const migratedBeachData = migrateLegacyBeachReservations(oldSets, createFreeExtraBeds(), []);

        return {
          sets: migratedBeachData.sets,
          extraBeds: migratedBeachData.extraBeds,
          beachReservations: migratedBeachData.beachReservations,
          savedSurnames: [],
          aquaparkReservations: [],
        };
      }
    }

    const oldestSets = loadLegacyStatuses();

    if (oldestSets) {
      const migratedBeachData = migrateLegacyBeachReservations(oldestSets, createFreeExtraBeds(), []);

      return {
        sets: migratedBeachData.sets,
        extraBeds: migratedBeachData.extraBeds,
        beachReservations: migratedBeachData.beachReservations,
        savedSurnames: [],
        aquaparkReservations: [],
      };
    }

    return defaults;
  } catch {
    return defaults;
  }
}

function getSets(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function updateSetStatus(set: BeachSet, status: SetStatus, details: Partial<BeachSet> = {}): BeachSet {
  const clearedDetails =
    status === 'reserved'
      ? { partialNote: undefined }
      : status === 'partial'
        ? { beachReservationId: undefined, surname: undefined, reservedDays: undefined }
        : { beachReservationId: undefined, surname: undefined, reservedDays: undefined, partialNote: undefined };

  return {
    ...set,
    ...clearedDetails,
    ...details,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function updateBedStatus(bed: ExtraBed, status: BedStatus, details: Partial<ExtraBed> = {}): ExtraBed {
  const clearedDetails =
    status === 'reserved' ? {} : { beachReservationId: undefined, surname: undefined, reservedDays: undefined };

  return {
    ...bed,
    ...clearedDetails,
    ...details,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function applyDailyResetToSets(currentSets: BeachSetMap): BeachSetMap {
  return Object.fromEntries(
    Object.values(currentSets).map((set) => [set.id, createBeachSet(set.id)]),
  ) as BeachSetMap;
}

function applyDailyResetToBeds(currentBeds: ExtraBedMap): ExtraBedMap {
  return Object.fromEntries(
    Object.values(currentBeds).map((bed) => [bed.id, createExtraBed(bed.id)]),
  ) as ExtraBedMap;
}

function applyDailyResetToBeachReservations(currentReservations: BeachReservation[]): BeachReservation[] {
  return currentReservations.flatMap((reservation) => {
    if (reservation.reservedDays <= 1) {
      return [];
    }

    return [
      {
        ...reservation,
        reservedDays: reservation.reservedDays - 1,
        updatedAt: new Date().toISOString(),
      },
    ];
  });
}

function applyDailyResetToAquaparkReservations(
  currentReservations: AquaparkReservation[],
): AquaparkReservation[] {
  return currentReservations.flatMap((reservation) => {
    if (reservation.reservedDays <= 1) {
      return [];
    }

    return [
      {
        ...reservation,
        reservedDays: reservation.reservedDays - 1,
        updatedAt: new Date().toISOString(),
      },
    ];
  });
}

function initializeAppDataForToday(appData: AppData, today = getLocalDateKey()): AppData {
  const lastResetDate = appData.lastAutomaticResetDate;

  // Older data without reset tracking starts safely today instead of being decremented unexpectedly.
  if (!lastResetDate || lastResetDate >= today) {
    return {
      ...appData,
      lastAutomaticResetDate: today,
    };
  }

  return {
    ...appData,
    sets: applyDailyResetToSets(appData.sets),
    extraBeds: applyDailyResetToBeds(appData.extraBeds),
    beachReservations: applyDailyResetToBeachReservations(appData.beachReservations),
    aquaparkReservations: applyDailyResetToAquaparkReservations(appData.aquaparkReservations),
    lastAutomaticResetDate: today,
  };
}

function formatDate(value?: string) {
  if (!value) {
    return 'No date';
  }

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatDaysLeft(days: number) {
  return days === 1 ? '1 day left' : `${days} days left`;
}

function findBeachReservationAssignments(
  reservationId: string,
  sets: BeachSetMap,
  extraBeds: ExtraBedMap,
): BeachAssignment[] {
  const assignedSets = Object.values(sets)
    .filter((set) => set.status === 'reserved' && set.beachReservationId === reservationId)
    .sort((first, second) => first.id - second.id)
    .map((set) => ({
      kind: 'set' as const,
      id: set.id,
      label: `Set ${set.id}`,
    }));
  const assignedBeds = Object.values(extraBeds)
    .filter((bed) => bed.status === 'reserved' && bed.beachReservationId === reservationId)
    .sort((first, second) => first.id - second.id)
    .map((bed) => ({
      kind: 'bed' as const,
      id: bed.id,
      label: bed.label,
    }));

  return [...assignedSets, ...assignedBeds];
}

function formatBeachAssignmentLabel(assignments: BeachAssignment[]) {
  if (!assignments.length) {
    return 'Not assigned today';
  }

  const assignmentList = assignments.map((assignment) => assignment.label).join(', ');
  return assignments.length > 3
    ? `Assigned to ${assignments.length} items: ${assignmentList}`
    : `Assigned to ${assignmentList}`;
}

function getBeachReservations(
  beachReservations: BeachReservation[],
  sets: BeachSetMap,
  extraBeds: ExtraBedMap,
): ActiveReservationSummary[] {
  return beachReservations.map((reservation) => {
    const assignments = findBeachReservationAssignments(reservation.id, sets, extraBeds);

    return {
      id: reservation.id,
      surname: reservation.surname,
      reservedDays: reservation.reservedDays,
      notes: reservation.notes,
      assignmentLabel: formatBeachAssignmentLabel(assignments),
    };
  }).sort(
    (first, second) => first.reservedDays - second.reservedDays || first.surname.localeCompare(second.surname),
  );
}

function createBackupPayload(appData: AppData): BackupPayload {
  return {
    app: 'Beach Set Manager',
    version: 6,
    exportedAt: new Date().toISOString(),
    sets: appData.sets,
    extraBeds: appData.extraBeds,
    beachReservations: appData.beachReservations,
    savedSurnames: appData.savedSurnames,
    aquaparkReservations: appData.aquaparkReservations,
    lastAutomaticResetDate: appData.lastAutomaticResetDate,
  };
}

function App() {
  const initialAppData = useMemo(() => initializeAppDataForToday(loadSavedAppData()), []);
  const [sets, setSets] = useState<BeachSetMap>(() => initialAppData.sets);
  const [extraBeds, setExtraBeds] = useState<ExtraBedMap>(() => initialAppData.extraBeds);
  const [beachReservations, setBeachReservations] = useState<BeachReservation[]>(
    () => initialAppData.beachReservations,
  );
  const [savedSurnames, setSavedSurnames] = useState<ReservationSurname[]>(
    () => initialAppData.savedSurnames,
  );
  const [aquaparkReservations, setAquaparkReservations] = useState<AquaparkReservation[]>(
    () => initialAppData.aquaparkReservations,
  );
  const [lastAutomaticResetDate, setLastAutomaticResetDate] = useState(
    () => initialAppData.lastAutomaticResetDate ?? getLocalDateKey(),
  );
  const [activeTab, setActiveTab] = useState<TabId>('beach1');
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const beachOneRef = useRef<HTMLElement | null>(null);
  const beachTwoRef = useRef<HTMLElement | null>(null);
  const bedsRef = useRef<HTMLElement | null>(null);
  const hasMountedTabScroll = useRef(false);
  const lastAutomaticResetDateRef = useRef(lastAutomaticResetDate);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sets,
        extraBeds,
        beachReservations,
        savedSurnames,
        aquaparkReservations,
        lastAutomaticResetDate,
      }),
    );
  }, [sets, extraBeds, beachReservations, savedSurnames, aquaparkReservations, lastAutomaticResetDate]);

  useEffect(() => {
    if (!hasMountedTabScroll.current) {
      hasMountedTabScroll.current = true;
      return;
    }

    window.requestAnimationFrame(() => {
      scrollToTabSection(activeTab);
    });
  }, [activeTab]);

  const counts = useMemo(() => {
    return STATUS_ORDER.reduce(
      (summary, status) => ({
        ...summary,
        [status]: Object.values(sets).filter((set) => set.status === status).length,
      }),
      {} as Record<SetStatus, number>,
    );
  }, [sets]);

  const bedCounts = useMemo(() => {
    return BED_STATUS_ORDER.reduce(
      (summary, status) => ({
        ...summary,
        [status]: Object.values(extraBeds).filter((bed) => bed.status === status).length,
      }),
      {} as Record<BedStatus, number>,
    );
  }, [extraBeds]);

  const beachReservationSummaries = useMemo(
    () => getBeachReservations(beachReservations, sets, extraBeds),
    [beachReservations, sets, extraBeds],
  );

  const activeSet = activeEditor?.kind === 'set' ? sets[activeEditor.id] : null;
  const activeBed = activeEditor?.kind === 'bed' ? extraBeds[activeEditor.id] : null;
  const activeAquaparkReservation =
    activeEditor?.kind === 'aquapark' && activeEditor.id
      ? aquaparkReservations.find((reservation) => reservation.id === activeEditor.id) ?? null
      : null;
  const activeBeachReservation =
    activeEditor?.kind === 'beachReservation'
      ? beachReservations.find((reservation) => reservation.id === activeEditor.id) ?? null
      : null;

  function completeDailyReset(resetDate: string, message?: string) {
    lastAutomaticResetDateRef.current = resetDate;
    setLastAutomaticResetDate(resetDate);
    setSets((currentSets) => applyDailyResetToSets(currentSets));
    setExtraBeds((currentBeds) => applyDailyResetToBeds(currentBeds));
    setBeachReservations((currentReservations) => applyDailyResetToBeachReservations(currentReservations));
    setAquaparkReservations((currentReservations) => applyDailyResetToAquaparkReservations(currentReservations));
    closeEditor();

    if (message) {
      setBackupMessage(message);
    }
  }

  useEffect(() => {
    function checkForNewDay() {
      const today = getLocalDateKey();
      const lastResetDate = lastAutomaticResetDateRef.current;

      if (lastResetDate === today) {
        return;
      }

      // A missing or future date should not cause an unexpected catch-up reset.
      if (!lastResetDate || lastResetDate > today) {
        lastAutomaticResetDateRef.current = today;
        setLastAutomaticResetDate(today);
        return;
      }

      completeDailyReset(today);
    }

    function scheduleMidnightCheck() {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const delay = Math.max(1_000, nextMidnight.getTime() - now.getTime() + 25);

      return window.setTimeout(() => {
        checkForNewDay();
        midnightTimer = scheduleMidnightCheck();
      }, delay);
    }

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        checkForNewDay();
      }
    };

    checkForNewDay();
    let midnightTimer = scheduleMidnightCheck();
    window.addEventListener('focus', checkForNewDay);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener('focus', checkForNewDay);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, []);

  function scrollToTabSection(tabId: TabId) {
    if (tabId === 'aquapark') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const target =
      tabId === 'beach1' ? beachOneRef.current : tabId === 'beach2' ? beachTwoRef.current : bedsRef.current;

    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectTab(tabId: TabId) {
    if (tabId === activeTab) {
      scrollToTabSection(tabId);
      return;
    }

    setActiveTab(tabId);
  }

  function openSetEditor(setId: number) {
    setActiveEditor({ kind: 'set', id: setId });
  }

  function openBedEditor(bedId: BedId) {
    setActiveEditor({ kind: 'bed', id: bedId });
  }

  function openNewAquaparkReservation() {
    setActiveEditor({ kind: 'aquapark' });
  }

  function openAquaparkReservation(reservationId: string) {
    setActiveEditor({ kind: 'aquapark', id: reservationId });
  }

  function openBeachReservation(reservationId: string) {
    setActiveEditor({ kind: 'beachReservation', id: reservationId });
  }

  function closeEditor() {
    setActiveEditor(null);
  }

  function saveSet(setId: number, status: SetStatus, details?: Partial<BeachSet>) {
    setSets((currentSets) => ({
      ...currentSets,
      [setId]: updateSetStatus(currentSets[setId], status, details),
    }));
  }

  function saveBed(bedId: BedId, status: BedStatus, details?: Partial<ExtraBed>) {
    setExtraBeds((currentBeds) => ({
      ...currentBeds,
      [bedId]: updateBedStatus(currentBeds[bedId], status, details),
    }));
  }

  function getCurrentSetReservationName(set: BeachSet) {
    const reservation = getLinkedBeachReservation(set.beachReservationId, beachReservations);
    return reservation?.surname || set.surname || 'another reservation';
  }

  function getCurrentBedReservationName(bed: ExtraBed) {
    const reservation = getLinkedBeachReservation(bed.beachReservationId, beachReservations);
    return reservation?.surname || bed.surname || 'another reservation';
  }

  function confirmItemReservationReplacement(currentSurname: string, nextSurname: string) {
    return window.confirm(`This item is already assigned to ${currentSurname}. Replace with ${nextSurname}?`);
  }

  function setBeachReservationAssignment(setId: number, reservation: BeachReservation) {
    setSets((currentSets) => ({
      ...currentSets,
      [setId]: updateSetStatus(currentSets[setId], 'reserved', {
        beachReservationId: reservation.id,
        surname: reservation.surname,
        reservedDays: reservation.reservedDays,
      }),
    }));
    closeEditor();
  }

  function setBedReservationAssignment(bedId: BedId, reservation: BeachReservation) {
    setExtraBeds((currentBeds) => ({
      ...currentBeds,
      [bedId]: updateBedStatus(currentBeds[bedId], 'reserved', {
        beachReservationId: reservation.id,
        surname: reservation.surname,
        reservedDays: reservation.reservedDays,
      }),
    }));
    closeEditor();
  }

  function assignBeachReservationToSet(setId: number, reservation: BeachReservation) {
    const currentSet = sets[setId];

    if (currentSet.status === 'reserved' && currentSet.beachReservationId === reservation.id) {
      closeEditor();
      return;
    }

    if (
      currentSet.status === 'reserved' &&
      !confirmItemReservationReplacement(getCurrentSetReservationName(currentSet), reservation.surname)
    ) {
      return;
    }

    setBeachReservationAssignment(setId, reservation);
  }

  function assignBeachReservationToBed(bedId: BedId, reservation: BeachReservation) {
    const currentBed = extraBeds[bedId];

    if (currentBed.status === 'reserved' && currentBed.beachReservationId === reservation.id) {
      closeEditor();
      return;
    }

    if (
      currentBed.status === 'reserved' &&
      !confirmItemReservationReplacement(getCurrentBedReservationName(currentBed), reservation.surname)
    ) {
      return;
    }

    setBedReservationAssignment(bedId, reservation);
  }

  function createAndAssignBeachReservationToSet(
    setId: number,
    details: BeachReservationDetails,
  ) {
    const surname = normalizeSurname(details.surname);
    const currentSet = sets[setId];

    if (!surname) {
      return;
    }

    if (
      currentSet.status === 'reserved' &&
      !confirmItemReservationReplacement(getCurrentSetReservationName(currentSet), surname)
    ) {
      return;
    }

    const reservation = createBeachReservation({ ...details, surname });
    saveReservationSurname(reservation.surname);
    setBeachReservations((currentReservations) => [reservation, ...currentReservations]);
    setBeachReservationAssignment(setId, reservation);
  }

  function createAndAssignBeachReservationToBed(
    bedId: BedId,
    details: BeachReservationDetails,
  ) {
    const surname = normalizeSurname(details.surname);
    const currentBed = extraBeds[bedId];

    if (!surname) {
      return;
    }

    if (
      currentBed.status === 'reserved' &&
      !confirmItemReservationReplacement(getCurrentBedReservationName(currentBed), surname)
    ) {
      return;
    }

    const reservation = createBeachReservation({ ...details, surname });
    saveReservationSurname(reservation.surname);
    setBeachReservations((currentReservations) => [reservation, ...currentReservations]);
    setBedReservationAssignment(bedId, reservation);
  }

  function saveReservationSurname(surname: string) {
    setSavedSurnames((currentSurnames) => upsertSavedSurname(currentSurnames, surname));
  }

  function saveBeachReservation(reservationId: string, details: BeachReservationDetails) {
    const surname = normalizeSurname(details.surname);

    if (!surname) {
      return;
    }

    saveReservationSurname(surname);
    setBeachReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        reservation.id === reservationId
          ? {
              ...reservation,
              surname,
              reservedDays: Math.max(1, Math.floor(details.reservedDays) || 1),
              notes: details.notes?.trim() || undefined,
              updatedAt: new Date().toISOString(),
            }
          : reservation,
      ),
    );
    closeEditor();
  }

  function deleteSavedSurname(surname: string) {
    setSavedSurnames((currentSurnames) =>
      currentSurnames.filter((savedSurname) => getSurnameKey(savedSurname) !== getSurnameKey(surname)),
    );
  }

  function saveAquaparkReservation(
    reservationId: string | undefined,
    details: { surname: string; reservedDays: number; notes?: string },
  ) {
    const surname = normalizeSurname(details.surname);

    if (!surname) {
      return;
    }

    saveReservationSurname(surname);

    if (!reservationId) {
      setAquaparkReservations((currentReservations) => [
        createAquaparkReservation({ ...details, surname }),
        ...currentReservations,
      ]);
      closeEditor();
      return;
    }

    setAquaparkReservations((currentReservations) =>
      currentReservations.map((reservation) =>
        reservation.id === reservationId
          ? {
              ...reservation,
              surname,
              reservedDays: Math.max(1, Math.floor(details.reservedDays) || 1),
              notes: details.notes?.trim() || undefined,
              updatedAt: new Date().toISOString(),
            }
          : reservation,
      ),
    );
    closeEditor();
  }

  function deleteAquaparkReservation(reservationId: string) {
    const confirmed = window.confirm('Cancel this Aquapark reservation?');

    if (confirmed) {
      setAquaparkReservations((currentReservations) =>
        currentReservations.filter((reservation) => reservation.id !== reservationId),
      );
      closeEditor();
    }
  }

  function deleteBeachReservation(reservationId: string) {
    const reservation = beachReservations.find((candidate) => candidate.id === reservationId);

    if (!reservation) {
      return;
    }

    const confirmed = window.confirm(
      `Delete reservation for ${reservation.surname}? This will also remove it from any assigned sets or beds.`,
    );

    if (!confirmed) {
      return;
    }

    setBeachReservations((currentReservations) =>
      currentReservations.filter((candidate) => candidate.id !== reservationId),
    );
    setSets((currentSets) =>
      Object.fromEntries(
        Object.values(currentSets).map((set) => [
          set.id,
          set.beachReservationId === reservationId ? updateSetStatus(set, 'free') : set,
        ]),
      ) as BeachSetMap,
    );
    setExtraBeds((currentBeds) =>
      Object.fromEntries(
        Object.values(currentBeds).map((bed) => [
          bed.id,
          bed.beachReservationId === reservationId ? updateBedStatus(bed, 'free') : bed,
        ]),
      ) as ExtraBedMap,
    );
    closeEditor();
  }

  function exportBackup() {
    const today = new Date().toISOString().slice(0, 10);
    const payload = createBackupPayload({
      sets,
      extraBeds,
      beachReservations,
      savedSurnames,
      aquaparkReservations,
      lastAutomaticResetDate,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `beach-sets-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setBackupMessage('Backup exported.');
  }

  function openImportPicker() {
    setBackupMessage(null);
    importInputRef.current?.click();
  }

  async function importBackup(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const imported = parseImportedAppData(JSON.parse(await file.text()));

      if (!imported) {
        setBackupMessage('Import failed: this backup file is not valid for Beach Set Manager.');
        return;
      }

      const confirmed = window.confirm(
        'Import this backup and replace the current data saved on this phone/browser?',
      );

      if (confirmed) {
        setSets(imported.sets);
        setExtraBeds(imported.extraBeds);
        setBeachReservations(imported.beachReservations);
        setSavedSurnames(imported.savedSurnames);
        setAquaparkReservations(imported.aquaparkReservations);
        const importedResetDate = imported.lastAutomaticResetDate ?? getLocalDateKey();
        lastAutomaticResetDateRef.current = importedResetDate;
        setLastAutomaticResetDate(importedResetDate);
        closeEditor();
        setBackupMessage('Backup imported.');
      }
    } catch {
      setBackupMessage('Import failed: choose a valid JSON backup file.');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  function resetDay() {
    const confirmed = window.confirm(
      [
        'Daily Reset will update all 56 sets, 4 extra beds, and Aquapark reservations.',
        '',
        '- Paid sets and beds become free.',
        '- Partial sets become free.',
        '- Beach set and bed assignments are cleared.',
        '- Saved Beach reservations lose 1 reserved day.',
        '- Beach reservations with 1 day left are removed.',
        '- Aquapark reservations lose 1 reserved day.',
        '- Aquapark reservations with 1 day left are removed.',
        '',
        'Continue?',
      ].join('\n'),
    );

    if (confirmed) {
      completeDailyReset(getLocalDateKey(), 'Daily reset complete.');
    }
  }

  function resetAppData() {
    const typed = window.prompt(
      'Danger: this clears all Beach Set Manager data saved in this browser. Type RESET to continue.',
    );

    if (typed === 'RESET') {
      APP_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      setSets(createFreeBeachSets());
      setExtraBeds(createFreeExtraBeds());
      setBeachReservations([]);
      setSavedSurnames([]);
      setAquaparkReservations([]);
      const today = getLocalDateKey();
      lastAutomaticResetDateRef.current = today;
      setLastAutomaticResetDate(today);
      closeEditor();
      setBackupMessage('All app data cleared.');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Summer shift board</p>
          <h1>Beach Set Manager</h1>
        </div>
        <button className="reset-button" type="button" onClick={resetDay}>
          Daily Reset
        </button>
      </header>

      <details className="local-tools">
        <summary>Backups and local tools</summary>
        <p>Saved locally on this device. Other phones have separate data.</p>
        <div className="tool-buttons">
          <button type="button" className="tool-button" onClick={exportBackup}>
            Export Backup
          </button>
          <button type="button" className="tool-button" onClick={openImportPicker}>
            Import Backup
          </button>
        </div>
        <input
          ref={importInputRef}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importBackup(event.target.files?.[0])}
        />
        {backupMessage ? <p className="backup-message">{backupMessage}</p> : null}
        <button type="button" className="danger-link" onClick={resetAppData}>
          Reset app data
        </button>
        <SavedSurnamesManager savedSurnames={savedSurnames} onDeleteSurname={deleteSavedSurname} />
      </details>

      {activeTab === 'aquapark' ? (
        <AquaparkPage
          reservations={aquaparkReservations}
          onCreateReservation={openNewAquaparkReservation}
          onEditReservation={openAquaparkReservation}
          onDeleteReservation={deleteAquaparkReservation}
        />
      ) : (
        <>
          <ActiveReservationsSection
            reservations={beachReservationSummaries}
            onEditReservation={openBeachReservation}
            onDeleteReservation={deleteBeachReservation}
          />

          <section className="status-strip" aria-label="Current set totals by status">
            {STATUS_ORDER.map((status) => (
              <div className={`status-pill status-${status}`} key={status}>
                <span>{STATUS_META[status].label}</span>
                <strong>{counts[status]}</strong>
              </div>
            ))}
          </section>

          <section className="legend" aria-label="Status color legend">
            {STATUS_ORDER.map((status) => (
              <span className={`legend-item status-${status}`} key={status}>
                <span className="legend-dot" />
                {STATUS_META[status].label}
              </span>
            ))}
          </section>

          <BeachOne
            sectionRef={beachOneRef}
            sets={sets}
            beachReservations={beachReservations}
            onEditSet={openSetEditor}
          />
          <BeachTwo
            sectionRef={beachTwoRef}
            sets={sets}
            beachReservations={beachReservations}
            onEditSet={openSetEditor}
          />
          <ExtraBedsSection
            sectionRef={bedsRef}
            beds={extraBeds}
            beachReservations={beachReservations}
            counts={bedCounts}
            onEditBed={openBedEditor}
          />
        </>
      )}

      {activeSet ? (
        <SetEditorModal
          set={activeSet}
          beachReservations={beachReservations}
          beachReservationAssignments={getBeachReservations(beachReservations, sets, extraBeds)}
          savedSurnames={savedSurnames}
          onClose={closeEditor}
          onSave={(status, details) => saveSet(activeSet.id, status, details)}
          onAssignReservation={(reservation) => assignBeachReservationToSet(activeSet.id, reservation)}
          onCreateReservation={(details) => createAndAssignBeachReservationToSet(activeSet.id, details)}
        />
      ) : null}

      {activeBed ? (
        <BedEditorModal
          bed={activeBed}
          beachReservations={beachReservations}
          beachReservationAssignments={getBeachReservations(beachReservations, sets, extraBeds)}
          savedSurnames={savedSurnames}
          onClose={closeEditor}
          onSave={(status, details) => saveBed(activeBed.id, status, details)}
          onAssignReservation={(reservation) => assignBeachReservationToBed(activeBed.id, reservation)}
          onCreateReservation={(details) => createAndAssignBeachReservationToBed(activeBed.id, details)}
        />
      ) : null}

      {activeEditor?.kind === 'aquapark' ? (
        <AquaparkReservationModal
          reservation={activeAquaparkReservation}
          savedSurnames={savedSurnames}
          onClose={closeEditor}
          onSave={(details) => saveAquaparkReservation(activeEditor.id, details)}
        />
      ) : null}

      {activeBeachReservation ? (
        <BeachReservationModal
          reservation={activeBeachReservation}
          savedSurnames={savedSurnames}
          onClose={closeEditor}
          onSave={(details) => saveBeachReservation(activeBeachReservation.id, details)}
        />
      ) : null}

      <BottomTabs activeTab={activeTab} onSelectTab={selectTab} />
    </main>
  );
}

function BeachOne({
  sectionRef,
  sets,
  beachReservations,
  onEditSet,
}: {
  sectionRef: MutableRefObject<HTMLElement | null>;
  sets: BeachSetMap;
  beachReservations: BeachReservation[];
  onEditSet: (setNumber: number) => void;
}) {
  return (
    <section
      ref={(node) => {
        sectionRef.current = node;
      }}
      className="beach-section beach-one"
      aria-labelledby="beach-one-heading"
    >
      <BeachHeader
        title="Beach 1"
        subtitle="Sets 1-20"
        summary="Two vertical rows: Upper starts at 20, Lower starts at 1"
      />
      <div className="beach-one-layout beach-map" aria-label="Beach 1 physical layout">
        <div className="water-edge" aria-hidden="true">
          Sea side
        </div>
        <div className="beach-one-map">
          <SetRow
            label="Upper Row"
            sets={BEACH_ONE_UPPER_ROW}
            beachSets={sets}
            beachReservations={beachReservations}
            onEditSet={onEditSet}
          />
          <SetRow
            label="Lower Row"
            sets={BEACH_ONE_LOWER_ROW}
            beachSets={sets}
            beachReservations={beachReservations}
            onEditSet={onEditSet}
          />
        </div>
      </div>
    </section>
  );
}

function BeachTwo({
  sectionRef,
  sets,
  beachReservations,
  onEditSet,
}: {
  sectionRef: MutableRefObject<HTMLElement | null>;
  sets: BeachSetMap;
  beachReservations: BeachReservation[];
  onEditSet: (setNumber: number) => void;
}) {
  return (
    <section
      ref={(node) => {
        sectionRef.current = node;
      }}
      className="beach-section beach-two"
      aria-labelledby="beach-two-heading"
    >
      <BeachHeader title="Beach 2" subtitle="Sets 21-56" summary="One long promenade from 21 to 56" />
      <div className="beach-two-path beach-map" aria-label="Beach 2 long beach path">
        <span className="path-cue start-cue">Start: Set 21</span>
        <span className="path-cue scroll-cue">Scroll to Set 56</span>
        <div className="beach-two-column">
          {getSets(21, 56).map((setNumber) => (
            <SetCard
              key={setNumber}
              beachSet={sets[setNumber]}
              beachReservations={beachReservations}
              onEdit={onEditSet}
            />
          ))}
        </div>
        <span className="path-cue end-cue">End: Set 56</span>
      </div>
    </section>
  );
}

function BeachHeader({
  title,
  subtitle,
  summary,
}: {
  title: string;
  subtitle: string;
  summary: string;
}) {
  return (
    <div className="beach-header">
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h2 id={title === 'Beach 1' ? 'beach-one-heading' : 'beach-two-heading'}>{title}</h2>
      </div>
      <span>{summary}</span>
    </div>
  );
}

function SetRow({
  label,
  sets,
  beachSets,
  beachReservations,
  onEditSet,
}: {
  label: string;
  sets: number[];
  beachSets: BeachSetMap;
  beachReservations: BeachReservation[];
  onEditSet: (setNumber: number) => void;
}) {
  return (
    <section className="beach-row-column">
      <span className="row-label">{label}</span>
      <div className="map-row">
        {sets.map((setNumber) => (
          <SetCard
            key={setNumber}
            beachSet={beachSets[setNumber]}
            beachReservations={beachReservations}
            onEdit={onEditSet}
          />
        ))}
      </div>
    </section>
  );
}

function SetCard({
  beachSet,
  beachReservations,
  onEdit,
}: {
  beachSet: BeachSet;
  beachReservations: BeachReservation[];
  onEdit: (setNumber: number) => void;
}) {
  const longPressTimer = useRef<number | null>(null);

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress() {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      onEdit(beachSet.id);
      longPressTimer.current = null;
    }, 520);
  }

  return (
    <button
      className={`set-card status-${beachSet.status}`}
      type="button"
      onClick={() => onEdit(beachSet.id)}
      onDoubleClick={() => onEdit(beachSet.id)}
      onPointerDown={startLongPress}
      onPointerLeave={clearLongPress}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      aria-label={`Set ${beachSet.id}, ${STATUS_META[beachSet.status].label}. Open editor.`}
    >
      <span className="set-number">Set {beachSet.id}</span>
      <SetIcon status={beachSet.status} />
      <SetDetails beachSet={beachSet} beachReservations={beachReservations} />
    </button>
  );
}

function ExtraBedsSection({
  sectionRef,
  beds,
  beachReservations,
  counts,
  onEditBed,
}: {
  sectionRef: MutableRefObject<HTMLElement | null>;
  beds: ExtraBedMap;
  beachReservations: BeachReservation[];
  counts: Record<BedStatus, number>;
  onEditBed: (bedId: BedId) => void;
}) {
  return (
    <section
      ref={(node) => {
        sectionRef.current = node;
      }}
      className="beach-section extra-beds-section"
      aria-labelledby="extra-beds-heading"
    >
      <div className="beach-header">
        <div>
          <p className="eyebrow">Separate from sets 1-56</p>
          <h2 id="extra-beds-heading">Extra Beds</h2>
        </div>
        <span>Four individual beds outside the normal set map</span>
      </div>

      <div className="bed-status-strip" aria-label="Extra bed status totals">
        {BED_STATUS_ORDER.map((status) => (
          <span className={`bed-status-pill status-${status}`} key={status}>
            {STATUS_META[status].label}: <strong>{counts[status]}</strong>
          </span>
        ))}
      </div>

      <div className="extra-beds-grid">
        {EXTRA_BED_IDS.map((bedId) => (
          <BedCard key={bedId} bed={beds[bedId]} beachReservations={beachReservations} onEdit={onEditBed} />
        ))}
      </div>
    </section>
  );
}

function BedCard({
  bed,
  beachReservations,
  onEdit,
}: {
  bed: ExtraBed;
  beachReservations: BeachReservation[];
  onEdit: (bedId: BedId) => void;
}) {
  return (
    <button
      className={`bed-card status-${bed.status}`}
      type="button"
      onClick={() => onEdit(bed.id)}
      aria-label={`${bed.label}, ${STATUS_META[bed.status].label}. Open editor.`}
    >
      <span className="set-number">{bed.label}</span>
      <BedIcon />
      <BedDetails bed={bed} beachReservations={beachReservations} />
    </button>
  );
}

function ActiveReservationsSection({
  reservations,
  onEditReservation,
  onDeleteReservation,
}: {
  reservations: ActiveReservationSummary[];
  onEditReservation: (reservationId: string) => void;
  onDeleteReservation: (reservationId: string) => void;
}) {
  return (
    <section className="active-reservations" aria-labelledby="active-reservations-heading">
      <div className="active-reservations-header">
        <div>
          <p className="eyebrow">Reserved now</p>
          <h2 id="active-reservations-heading">Beach Reservations ({reservations.length})</h2>
        </div>
      </div>

      {reservations.length ? (
        <div className="active-reservation-list">
          {reservations.map((reservation) => (
            <article className="active-reservation-card" key={reservation.id}>
              <div className="active-reservation-card-header">
                <strong>{reservation.surname}</strong>
                <span className="active-days">{formatDaysLeft(reservation.reservedDays)}</span>
              </div>
              {reservation.notes ? <p className="active-reservation-notes">{reservation.notes}</p> : null}
              <p className="active-reservation-meta">{reservation.assignmentLabel}</p>
              <div className="active-reservation-actions">
                <button
                  type="button"
                  className="active-reservation-edit"
                  onClick={() => onEditReservation(reservation.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="active-reservation-delete"
                  onClick={() => onDeleteReservation(reservation.id)}
                  aria-label={`Delete reservation for ${reservation.surname}`}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="no-active-reservations">No active reservations.</p>
      )}
    </section>
  );
}

function BeachReservationModal({
  reservation,
  savedSurnames,
  onClose,
  onSave,
}: {
  reservation: BeachReservation;
  savedSurnames: ReservationSurname[];
  onClose: () => void;
  onSave: (details: BeachReservationDetails) => void;
}) {
  const [surname, setSurname] = useState(reservation.surname);
  const [reservedDays, setReservedDays] = useState(String(reservation.reservedDays));
  const [notes, setNotes] = useState(reservation.notes ?? '');
  const normalizedDays = Number(reservedDays);
  const canSave = normalizeSurname(surname).length > 0 && Number.isInteger(normalizedDays) && normalizedDays > 0;

  function save() {
    if (!canSave) {
      return;
    }

    onSave({
      surname,
      reservedDays: normalizedDays,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="beach-reservation-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Saved beach reservation</p>
            <h2 id="beach-reservation-editor-title">Edit Reservation</h2>
          </div>
          <button type="button" className="close-button" aria-label="Close reservation editor" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="detail-panel reservation-edit-panel">
          <SurnameInput
            inputId="beach-reservation-edit-surname"
            value={surname}
            savedSurnames={savedSurnames}
            onChange={setSurname}
          />
          <label>
            Reserved days
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={reservedDays}
              onChange={(event) => setReservedDays(event.target.value)}
            />
          </label>
          <label>
            Description / notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              placeholder="Optional details, preferences, or party size"
            />
          </label>
          <button type="button" className="sheet-button reserved-action" onClick={save} disabled={!canSave}>
            Save Reservation
          </button>
        </div>

        <button type="button" className="cancel-button" onClick={onClose}>
          Cancel
        </button>
      </section>
    </div>
  );
}

function SurnameInput({
  inputId,
  value,
  savedSurnames,
  onChange,
}: {
  inputId: string;
  value: string;
  savedSurnames: ReservationSurname[];
  onChange: (value: string) => void;
}) {
  const listId = `${inputId}-options`;

  return (
    <label>
      Customer surname
      <input
        id={inputId}
        type="text"
        value={value}
        list={savedSurnames.length ? listId : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. Novak"
        autoComplete="family-name"
      />
      {savedSurnames.length ? (
        <datalist id={listId}>
          {savedSurnames.map((savedSurname) => (
            <option value={savedSurname} key={savedSurname} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

function SavedSurnamesManager({
  savedSurnames,
  onDeleteSurname,
}: {
  savedSurnames: ReservationSurname[];
  onDeleteSurname: (surname: string) => void;
}) {
  return (
    <section className="saved-surnames" aria-label="Saved reservation surnames">
      <h3>Saved surnames</h3>
      {savedSurnames.length ? (
        <div className="surname-chip-list">
          {savedSurnames.map((surname) => (
            <span className="surname-chip" key={surname}>
              {surname}
              <button type="button" onClick={() => onDeleteSurname(surname)} aria-label={`Delete ${surname}`}>
                Remove
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p>No saved surnames yet.</p>
      )}
    </section>
  );
}

function AquaparkPage({
  reservations,
  onCreateReservation,
  onEditReservation,
  onDeleteReservation,
}: {
  reservations: AquaparkReservation[];
  onCreateReservation: () => void;
  onEditReservation: (reservationId: string) => void;
  onDeleteReservation: (reservationId: string) => void;
}) {
  return (
    <section className="aquapark-page" aria-labelledby="aquapark-heading">
      <div className="aquapark-hero">
        <div>
          <p className="eyebrow">Multi-day reservations</p>
          <h2 id="aquapark-heading">Aquapark</h2>
        </div>
        <button type="button" className="aquapark-primary-button" onClick={onCreateReservation}>
          New Aquapark Reservation
        </button>
      </div>

      {reservations.length ? (
        <div className="aquapark-reservation-list">
          {reservations.map((reservation) => (
            <AquaparkReservationCard
              key={reservation.id}
              reservation={reservation}
              onEdit={onEditReservation}
              onDelete={onDeleteReservation}
            />
          ))}
        </div>
      ) : (
        <div className="empty-aquapark">
          <strong>No active Aquapark reservations</strong>
          <span>New reservations will stay saved on this phone/browser.</span>
        </div>
      )}
    </section>
  );
}

function AquaparkReservationCard({
  reservation,
  onEdit,
  onDelete,
}: {
  reservation: AquaparkReservation;
  onEdit: (reservationId: string) => void;
  onDelete: (reservationId: string) => void;
}) {
  return (
    <article className="aquapark-card">
      <div className="aquapark-card-main">
        <div>
          <p className="eyebrow">Reservation</p>
          <h3>{reservation.surname}</h3>
        </div>
        <span className="days-badge">{formatDays(reservation.reservedDays)}</span>
      </div>
      {reservation.notes ? <p className="aquapark-notes">{reservation.notes}</p> : null}
      <p className="aquapark-date">
        {reservation.updatedAt ? `Updated ${formatDate(reservation.updatedAt)}` : `Created ${formatDate(reservation.createdAt)}`}
      </p>
      <div className="aquapark-card-actions">
        <button type="button" onClick={() => onEdit(reservation.id)}>
          Edit
        </button>
        <button type="button" className="danger-link" onClick={() => onDelete(reservation.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}

function BottomTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: TabId;
  onSelectTab: (tabId: TabId) => void;
}) {
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'beach1', label: 'Beach 1' },
    { id: 'beach2', label: 'Beach 2' },
    { id: 'beds', label: 'Beds' },
    { id: 'aquapark', label: 'Aquapark' },
  ];

  return (
    <nav className="bottom-tabs" aria-label="Main app sections">
      {tabs.map((tab) => (
        <button
          type="button"
          className={`bottom-tab tab-${tab.id}${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          key={tab.id}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function SetDetails({
  beachSet,
  beachReservations,
}: {
  beachSet: BeachSet;
  beachReservations: BeachReservation[];
}) {
  if (beachSet.status === 'paid') {
    return (
      <span className="card-detail">
        <strong>Paid</strong>
        <small>2 beds + parasol</small>
      </span>
    );
  }

  if (beachSet.status === 'reserved') {
    const reservation = getLinkedBeachReservation(beachSet.beachReservationId, beachReservations);

    return (
      <span className="card-detail">
        <strong>Reserved</strong>
        <small>{reservation?.surname || beachSet.surname || 'Missing reservation'}</small>
        <small>{formatDays(reservation?.reservedDays ?? beachSet.reservedDays)}</small>
      </span>
    );
  }

  if (beachSet.status === 'partial') {
    return (
      <span className="card-detail">
        <strong>Partial</strong>
        <small>{beachSet.partialNote || 'Add note'}</small>
      </span>
    );
  }

  return (
    <span className="card-detail">
      <strong>Free</strong>
      <small>Available</small>
    </span>
  );
}

function BedDetails({ bed, beachReservations }: { bed: ExtraBed; beachReservations: BeachReservation[] }) {
  if (bed.status === 'paid') {
    return (
      <span className="card-detail">
        <strong>Paid</strong>
        <small>Bed only</small>
      </span>
    );
  }

  if (bed.status === 'reserved') {
    const reservation = getLinkedBeachReservation(bed.beachReservationId, beachReservations);

    return (
      <span className="card-detail">
        <strong>Reserved</strong>
        <small>{reservation?.surname || bed.surname || 'Missing reservation'}</small>
        <small>{formatDays(reservation?.reservedDays ?? bed.reservedDays)}</small>
      </span>
    );
  }

  return (
    <span className="card-detail">
      <strong>Free</strong>
      <small>Available</small>
    </span>
  );
}

function formatDays(days?: number) {
  if (!days || days < 1) {
    return 'Days not set';
  }

  return days === 1 ? '1 day' : `${days} days`;
}

function getLinkedBeachReservation(
  beachReservationId: string | undefined,
  beachReservations: BeachReservation[],
) {
  return beachReservationId
    ? beachReservations.find((reservation) => reservation.id === beachReservationId) ?? null
    : null;
}

function BeachReservationAssignmentPanel({
  itemLabel,
  currentBeachReservationId,
  beachReservations,
  beachReservationAssignments,
  savedSurnames,
  inputIdPrefix,
  onAssignReservation,
  onCreateReservation,
}: {
  itemLabel: string;
  currentBeachReservationId?: string;
  beachReservations: BeachReservation[];
  beachReservationAssignments: ActiveReservationSummary[];
  savedSurnames: ReservationSurname[];
  inputIdPrefix: string;
  onAssignReservation: (reservation: BeachReservation) => void;
  onCreateReservation: (details: BeachReservationDetails) => void;
}) {
  const [assignmentMode, setAssignmentMode] = useState<'existing' | 'new'>(
    beachReservations.length ? 'existing' : 'new',
  );
  const [selectedReservationId, setSelectedReservationId] = useState(
    currentBeachReservationId ?? beachReservations[0]?.id ?? '',
  );
  const [surname, setSurname] = useState('');
  const [reservedDays, setReservedDays] = useState('1');
  const [notes, setNotes] = useState('');
  const canCreateReservation = normalizeSurname(surname).length > 0;

  function getAssignmentLabel(reservationId: string) {
    return (
      beachReservationAssignments.find((assignment) => assignment.id === reservationId)?.assignmentLabel ??
      'Not assigned today'
    );
  }

  function assignExistingReservation() {
    const reservation = beachReservations.find((candidate) => candidate.id === selectedReservationId);

    if (reservation) {
      onAssignReservation(reservation);
    }
  }

  function createNewReservation() {
    if (!canCreateReservation) {
      return;
    }

    onCreateReservation({
      surname,
      reservedDays: Math.max(1, Number(reservedDays) || 1),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="detail-panel reservation-assignment-panel">
      <p className="assignment-helper">
        Assign a saved Beach reservation to {itemLabel}, or create a new one for today.
      </p>

      <div className="quick-options reservation-mode-options" aria-label="Beach reservation options">
        <button
          type="button"
          className={assignmentMode === 'existing' ? 'quick-option selected reserved-choice' : 'quick-option'}
          onClick={() => setAssignmentMode('existing')}
          disabled={!beachReservations.length}
        >
          Choose existing beach reservation
        </button>
        <button
          type="button"
          className={assignmentMode === 'new' ? 'quick-option selected reserved-choice' : 'quick-option'}
          onClick={() => setAssignmentMode('new')}
        >
          Create new beach reservation
        </button>
      </div>

      {assignmentMode === 'existing' && beachReservations.length ? (
        <>
          <div className="existing-reservation-list" aria-label="Active beach reservations">
            {beachReservations.map((reservation) => {
              const isSelected = reservation.id === selectedReservationId;

              return (
                <button
                  type="button"
                  className={`existing-reservation-option${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedReservationId(reservation.id)}
                  aria-pressed={isSelected}
                  key={reservation.id}
                >
                  <span className="existing-reservation-option-header">
                    <strong>{reservation.surname}</strong>
                    <span>{formatDaysLeft(reservation.reservedDays)}</span>
                  </span>
                  {reservation.notes ? <span className="existing-reservation-option-notes">{reservation.notes}</span> : null}
                  <span className="existing-reservation-option-assignment">
                    {getAssignmentLabel(reservation.id)}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="sheet-button reserved-action"
            onClick={assignExistingReservation}
            disabled={!selectedReservationId}
          >
            Assign Existing Reservation
          </button>
        </>
      ) : null}

      {assignmentMode === 'new' ? (
        <>
          <SurnameInput
            inputId={`${inputIdPrefix}-surname`}
            value={surname}
            savedSurnames={savedSurnames}
            onChange={setSurname}
          />
          <label>
            Reserved days
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={reservedDays}
              onChange={(event) => setReservedDays(event.target.value)}
            />
          </label>
          <label>
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional"
            />
          </label>
          <button
            type="button"
            className="sheet-button reserved-action"
            onClick={createNewReservation}
            disabled={!canCreateReservation}
          >
            Create and Assign Reservation
          </button>
        </>
      ) : null}
    </div>
  );
}

function SetEditorModal({
  set,
  beachReservations,
  beachReservationAssignments,
  savedSurnames,
  onClose,
  onSave,
  onAssignReservation,
  onCreateReservation,
}: {
  set: BeachSet;
  beachReservations: BeachReservation[];
  beachReservationAssignments: ActiveReservationSummary[];
  savedSurnames: ReservationSurname[];
  onClose: () => void;
  onSave: (status: SetStatus, details?: Partial<BeachSet>) => void;
  onAssignReservation: (reservation: BeachReservation) => void;
  onCreateReservation: (details: BeachReservationDetails) => void;
}) {
  const [mode, setMode] = useState<DetailMode>('actions');
  const [partialNote, setPartialNote] = useState(set.partialNote ?? PARTIAL_OPTIONS[0]);

  function saveAndClose(status: SetStatus, details?: Partial<BeachSet>) {
    onSave(status, details);
    onClose();
  }

  function savePartial() {
    saveAndClose('partial', {
      partialNote: partialNote.trim() || 'Partial payment',
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Beach {set.beach}</p>
            <h2 id="set-editor-title">Set {set.id}</h2>
          </div>
          <div className="sheet-header-actions">
            <span className={`current-status status-${set.status}`}>
              {STATUS_META[set.status].label}
            </span>
            <button type="button" className="close-button" aria-label="Close set editor" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="sheet-actions">
          <button type="button" className="sheet-button free-action" onClick={() => saveAndClose('free')}>
            Mark Free
          </button>
          <button type="button" className="sheet-button paid-action" onClick={() => saveAndClose('paid')}>
            Mark Paid Full Set
          </button>
          <button type="button" className="sheet-button reserved-action" onClick={() => setMode('reserved')}>
            Mark Reserved
          </button>
          <button type="button" className="sheet-button partial-action" onClick={() => setMode('partial')}>
            Mark Partial Payment
          </button>
        </div>

        {mode === 'reserved' ? (
          <BeachReservationAssignmentPanel
            itemLabel={`Set ${set.id}`}
            currentBeachReservationId={set.beachReservationId}
            beachReservations={beachReservations}
            beachReservationAssignments={beachReservationAssignments}
            savedSurnames={savedSurnames}
            inputIdPrefix="set-reservation"
            onAssignReservation={onAssignReservation}
            onCreateReservation={onCreateReservation}
          />
        ) : null}

        {mode === 'partial' ? (
          <div className="detail-panel">
            <div className="quick-options" aria-label="Partial payment quick options">
              {PARTIAL_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={partialNote === option ? 'quick-option selected' : 'quick-option'}
                  key={option}
                  onClick={() => setPartialNote(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <label>
              Custom note
              <textarea
                value={partialNote}
                onChange={(event) => setPartialNote(event.target.value)}
                rows={3}
                placeholder="Write what was paid"
              />
            </label>
            <button type="button" className="sheet-button partial-action" onClick={savePartial}>
              Save Partial Payment
            </button>
          </div>
        ) : null}

        <button type="button" className="cancel-button" onClick={onClose}>
          Cancel
        </button>
      </section>
    </div>
  );
}

function BedEditorModal({
  bed,
  beachReservations,
  beachReservationAssignments,
  savedSurnames,
  onClose,
  onSave,
  onAssignReservation,
  onCreateReservation,
}: {
  bed: ExtraBed;
  beachReservations: BeachReservation[];
  beachReservationAssignments: ActiveReservationSummary[];
  savedSurnames: ReservationSurname[];
  onClose: () => void;
  onSave: (status: BedStatus, details?: Partial<ExtraBed>) => void;
  onAssignReservation: (reservation: BeachReservation) => void;
  onCreateReservation: (details: BeachReservationDetails) => void;
}) {
  const [mode, setMode] = useState<'actions' | 'reserved'>('actions');

  function saveAndClose(status: BedStatus, details?: Partial<ExtraBed>) {
    onSave(status, details);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bed-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Extra Beds</p>
            <h2 id="bed-editor-title">{bed.label}</h2>
          </div>
          <div className="sheet-header-actions">
            <span className={`current-status status-${bed.status}`}>
              {STATUS_META[bed.status].label}
            </span>
            <button type="button" className="close-button" aria-label="Close bed editor" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="sheet-actions">
          <button type="button" className="sheet-button free-action" onClick={() => saveAndClose('free')}>
            Mark Free
          </button>
          <button type="button" className="sheet-button paid-action" onClick={() => saveAndClose('paid')}>
            Mark Paid Bed
          </button>
          <button type="button" className="sheet-button reserved-action" onClick={() => setMode('reserved')}>
            Mark Reserved
          </button>
        </div>

        {mode === 'reserved' ? (
          <BeachReservationAssignmentPanel
            itemLabel={bed.label}
            currentBeachReservationId={bed.beachReservationId}
            beachReservations={beachReservations}
            beachReservationAssignments={beachReservationAssignments}
            savedSurnames={savedSurnames}
            inputIdPrefix="bed-reservation"
            onAssignReservation={onAssignReservation}
            onCreateReservation={onCreateReservation}
          />
        ) : null}

        <button type="button" className="cancel-button" onClick={onClose}>
          Cancel
        </button>
      </section>
    </div>
  );
}

function AquaparkReservationModal({
  reservation,
  savedSurnames,
  onClose,
  onSave,
}: {
  reservation: AquaparkReservation | null;
  savedSurnames: ReservationSurname[];
  onClose: () => void;
  onSave: (details: { surname: string; reservedDays: number; notes?: string }) => void;
}) {
  const [surname, setSurname] = useState(reservation?.surname ?? '');
  const [reservedDays, setReservedDays] = useState(String(reservation?.reservedDays ?? 1));
  const [notes, setNotes] = useState(reservation?.notes ?? '');
  const canSave = normalizeSurname(surname).length > 0;

  function saveReservation() {
    if (!canSave) {
      return;
    }

    onSave({
      surname,
      reservedDays: Math.max(1, Number(reservedDays) || 1),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aquapark-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Aquapark</p>
            <h2 id="aquapark-editor-title">
              {reservation ? 'Edit Reservation' : 'New Aquapark Reservation'}
            </h2>
          </div>
          <button type="button" className="close-button" aria-label="Close Aquapark editor" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="detail-panel aquapark-editor-panel">
          <SurnameInput
            inputId="aquapark-reservation-surname"
            value={surname}
            savedSurnames={savedSurnames}
            onChange={setSurname}
          />
          <label>
            Reserved days
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={reservedDays}
              onChange={(event) => setReservedDays(event.target.value)}
            />
          </label>
          <label>
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Optional"
            />
          </label>
          <button
            type="button"
            className="sheet-button aquapark-save-action"
            onClick={saveReservation}
            disabled={!canSave}
          >
            Save Aquapark Reservation
          </button>
        </div>

        <button type="button" className="cancel-button" onClick={onClose}>
          Cancel
        </button>
      </section>
    </div>
  );
}

function SetIcon({ status }: { status: SetStatus }) {
  return (
    <span className={`set-icon icon-${status}`} aria-hidden="true">
      <span className="parasol">
        <span className="canopy" />
        <span className="pole" />
      </span>
      <span className="sunbeds">
        <span className="sunbed" />
        <span className="sunbed" />
      </span>
    </span>
  );
}

function BedIcon() {
  return (
    <span className="bed-icon" aria-hidden="true">
      <span className="bed-pillow" />
      <span className="bed-frame" />
    </span>
  );
}

export default App;
