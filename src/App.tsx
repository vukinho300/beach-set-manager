import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import './App.css';

type SetStatus = 'free' | 'paid' | 'reserved' | 'partial';
type BedStatus = Exclude<SetStatus, 'partial'>;
type BeachId = 1 | 2;
type BedId = 1 | 2 | 3 | 4;
type BedLabel = `Bed ${BedId}`;
type ReservationSurname = string;
type TabId = 'beach1' | 'beach2' | 'beds' | 'sunbeds' | 'aquapark' | 'report';
type SetPriceMode = 'fixed' | 'special';
type AquaparkTicketType = '30min' | '1hour' | 'half_day' | 'one_day' | 'one_week' | 'custom_days';
type AquaparkPriceMode = 'default' | 'special';

type BeachSet = {
  id: number;
  beach: BeachId;
  status: SetStatus;
  beachReservationId?: string;
  surname?: string;
  reservedDays?: number;
  partialNote?: string;
  price?: number;
  priceMode?: SetPriceMode;
  dailySaleId?: string;
  updatedAt?: string;
};

type ExtraBed = {
  id: BedId;
  label: BedLabel;
  status: BedStatus;
  beachReservationId?: string;
  surname?: string;
  reservedDays?: number;
  price?: number;
  priceMode?: SetPriceMode;
  dailySaleId?: string;
  updatedAt?: string;
};

type BeachReservation = {
  id: string;
  surname: string;
  startDate: string;
  endDate: string;
  totalAmountPaid?: number;
  paymentRecordedAt?: string;
  reservedDays?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

type BeachReservationDetails = {
  surname: string;
  startDate: string;
  endDate: string;
  totalAmountPaid?: number;
  notes?: string;
};

type AquaparkEntry = {
  id: string;
  wristbands: number[];
  ticketType: AquaparkTicketType;
  defaultUnitPrice: number;
  unitPrice: number;
  totalPrice: number;
  priceMode: AquaparkPriceMode;
  status: 'active' | 'closed';
  isLegacyPrice?: boolean;
  startAt: string;
  endAt?: string;
  extraMinutes: number;
  validUntil?: string;
  customDays?: number;
  dailyUnitPrice?: number;
  description?: string;
  createdAt: string;
  closedAt?: string;
};

type NonNumberedSunbedSale = {
  id: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
};

type DailySale =
  | {
      id: string;
      kind: 'beach_set';
      setId: number;
      amount: number;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'aquapark_entry';
      entryId: string;
      ticketType: AquaparkTicketType;
      wristbandCount: number;
      unitPrice: number;
      customDays?: number;
      amount: number;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'bed';
      bedId: BedId;
      amount: number;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'sunbed';
      sunbedSaleId: string;
      quantity: number;
      amount: number;
      createdAt: string;
    };

type AquaparkEntryDetails = {
  wristbands: number[];
  ticketType: AquaparkTicketType;
  specialPrice?: number;
  customDays?: number;
  dailyUnitPrice?: number;
  extraMinutes?: number;
  description?: string;
};

type BeachSetMap = Record<number, BeachSet>;
type ExtraBedMap = Record<BedId, ExtraBed>;
type DetailMode = 'actions' | 'reserved' | 'partial';
type ActiveEditor =
  | { kind: 'set'; id: number }
  | { kind: 'bed'; id: BedId }
  | { kind: 'beachReservation'; id: string }
  | { kind: 'sunbedSale'; id?: string }
  | { kind: 'aquaparkEntry' };
type ActiveReservationSummary = {
  id: string;
  surname: string;
  startDate: string;
  endDate: string;
  totalAmountPaid?: number;
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
  sunbedSales: NonNumberedSunbedSale[];
  aquaparkEntries: AquaparkEntry[];
  dailySales: DailySale[];
  lastAutomaticResetDate?: string;
};
type BackupPayload = AppData & {
  app: 'Beach Set Manager';
  version: 10;
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
const AQUAPARK_TICKETS: Record<AquaparkTicketType, { label: string; price: number }> = {
  '30min': { label: '30 minutes', price: 12 },
  '1hour': { label: '1 hour', price: 14 },
  half_day: { label: 'Half day', price: 20 },
  one_day: { label: 'One day', price: 25 },
  one_week: { label: 'One week', price: 99 },
  custom_days: { label: 'Custom Days', price: 15 },
};

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
    sunbedSales: [],
    aquaparkEntries: [],
    dailySales: [],
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

function isSetPriceMode(value: unknown): value is SetPriceMode {
  return value === 'fixed' || value === 'special';
}

function isAquaparkTicketType(value: unknown): value is AquaparkTicketType {
  return typeof value === 'string' && value in AQUAPARK_TICKETS;
}

function isAquaparkPriceMode(value: unknown): value is AquaparkPriceMode {
  return value === 'default' || value === 'special';
}

function normalizePositiveMoney(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : undefined;
}

function normalizeNonNegativeMoney(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100) / 100
    : undefined;
}

function parsePositiveMoney(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return normalizePositiveMoney(Number(normalized)) ?? null;
}

function parseNonNegativeMoney(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return normalizeNonNegativeMoney(Number(normalized)) ?? null;
}

function isLocalDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return getLocalDateKey(date);
}

function getInclusiveDateDays(startDate: string, endDate: string): number {
  if (!isLocalDateKey(startDate) || !isLocalDateKey(endDate) || endDate < startDate) {
    return 0;
  }

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.floor((end - start) / 86_400_000) + 1;
}

function formatReservationDates(startDate: string, endDate: string): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const format = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
  };
  return `${format(startDate)} to ${format(endDate)}`;
}

function formatEuro(amount: number): string {
  return `€${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
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
    startDate: details.startDate,
    endDate: details.endDate,
    totalAmountPaid: details.totalAmountPaid,
    paymentRecordedAt: details.totalAmountPaid && details.totalAmountPaid > 0 ? now : undefined,
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
    price: normalizePositiveMoney(value.price),
    priceMode: isSetPriceMode(value.priceMode) ? value.priceMode : undefined,
    dailySaleId: typeof value.dailySaleId === 'string' ? value.dailySaleId : undefined,
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
  const price = normalizePositiveMoney(value.price);
  const priceMode = isSetPriceMode(value.priceMode) ? value.priceMode : undefined;
  const dailySaleId = typeof value.dailySaleId === 'string' && value.dailySaleId.trim()
    ? value.dailySaleId
    : undefined;
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
    price,
    priceMode: price ? priceMode : undefined,
    dailySaleId,
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
    price: normalizePositiveMoney(value.price),
    priceMode: isSetPriceMode(value.priceMode) ? value.priceMode : undefined,
    dailySaleId: typeof value.dailySaleId === 'string' ? value.dailySaleId : undefined,
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
  const price = normalizePositiveMoney(value.price);
  const priceMode = isSetPriceMode(value.priceMode) ? value.priceMode : undefined;
  const dailySaleId = typeof value.dailySaleId === 'string' && value.dailySaleId.trim()
    ? value.dailySaleId
    : undefined;
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
    price,
    priceMode: price ? priceMode : undefined,
    dailySaleId,
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
  const legacyReservedDays =
    typeof candidate.reservedDays === 'number' && Number.isFinite(candidate.reservedDays)
      ? Math.max(1, Math.floor(candidate.reservedDays))
      : undefined;
  const startDate = isLocalDateKey(candidate.startDate) ? candidate.startDate : undefined;
  const endDate = isLocalDateKey(candidate.endDate) ? candidate.endDate : undefined;
  const migratedStartDate = startDate ?? getLocalDateKey();
  const migratedEndDate = endDate ?? addDaysToDateKey(migratedStartDate, (legacyReservedDays ?? 1) - 1);
  const totalAmountPaid = normalizeNonNegativeMoney(candidate.totalAmountPaid);
  const paymentRecordedAt = typeof candidate.paymentRecordedAt === 'string' && !Number.isNaN(new Date(candidate.paymentRecordedAt).getTime())
    ? candidate.paymentRecordedAt
    : undefined;
  const notes = typeof candidate.notes === 'string' ? candidate.notes.trim() : undefined;
  const createdAt =
    typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
      ? candidate.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim() ? candidate.updatedAt : undefined;

  if (!id || !surname || migratedEndDate < migratedStartDate) {
    return null;
  }

  return {
    id,
    surname,
    startDate: migratedStartDate,
    endDate: migratedEndDate,
    totalAmountPaid,
    paymentRecordedAt,
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

function normalizeImportedAquaparkEntry(value: unknown): AquaparkEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AquaparkEntry> & { defaultPrice?: unknown; finalPrice?: unknown };
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : undefined;
  const wristbands = Array.isArray(candidate.wristbands)
    ? [...new Set(candidate.wristbands.filter((wristband) => Number.isSafeInteger(wristband) && wristband > 0))]
    : [];
  const ticketType = isAquaparkTicketType(candidate.ticketType) ? candidate.ticketType : undefined;
  const defaultUnitPrice = normalizePositiveMoney(candidate.defaultUnitPrice) ?? normalizePositiveMoney(candidate.defaultPrice);
  const storedUnitPrice = normalizePositiveMoney(candidate.unitPrice);
  const storedTotalPrice = normalizePositiveMoney(candidate.totalPrice);
  const legacyFinalPrice = normalizePositiveMoney(candidate.finalPrice);
  const isLegacyPrice = !storedUnitPrice && !storedTotalPrice && Boolean(legacyFinalPrice);
  const unitPrice = storedUnitPrice ?? legacyFinalPrice;
  const totalPrice = storedTotalPrice ?? legacyFinalPrice;
  const priceMode = isAquaparkPriceMode(candidate.priceMode) ? candidate.priceMode : undefined;
  const startAt = typeof candidate.startAt === 'string' && !Number.isNaN(new Date(candidate.startAt).getTime())
    ? candidate.startAt
    : undefined;
  const endAt = typeof candidate.endAt === 'string' && !Number.isNaN(new Date(candidate.endAt).getTime())
    ? candidate.endAt
    : undefined;
  const extraMinutes = Number.isSafeInteger(candidate.extraMinutes) && (candidate.extraMinutes as number) >= 0
    ? candidate.extraMinutes as number
    : 0;
  const validUntil = typeof candidate.validUntil === 'string' && !Number.isNaN(new Date(candidate.validUntil).getTime())
    ? candidate.validUntil
    : undefined;
  const description = typeof candidate.description === 'string' ? candidate.description.trim() || undefined : undefined;
  const createdAt = typeof candidate.createdAt === 'string' && !Number.isNaN(new Date(candidate.createdAt).getTime())
    ? candidate.createdAt
    : startAt;
  const closedAt = typeof candidate.closedAt === 'string' && !Number.isNaN(new Date(candidate.closedAt).getTime())
    ? candidate.closedAt
    : undefined;

  if (!id || !wristbands.length || !ticketType || !defaultUnitPrice || !unitPrice || !totalPrice || !priceMode || !startAt || !createdAt) {
    return null;
  }

  const customDays = ticketType === 'custom_days' && Number.isSafeInteger(candidate.customDays) && (candidate.customDays as number) > 0
    ? candidate.customDays as number
    : undefined;
  const dailyUnitPrice = ticketType === 'custom_days'
    ? normalizePositiveMoney(candidate.dailyUnitPrice) ?? unitPrice
    : undefined;

  if ((ticketType === 'one_week' || ticketType === 'custom_days') ? !validUntil : !endAt) {
    return null;
  }

  if (ticketType === 'custom_days' && (!customDays || !dailyUnitPrice)) {
    return null;
  }

  return {
    id,
    wristbands,
    ticketType,
    defaultUnitPrice,
    unitPrice,
    totalPrice,
    priceMode,
    status: candidate.status === 'closed' ? 'closed' : 'active',
    isLegacyPrice: isLegacyPrice || undefined,
    startAt,
    endAt,
    extraMinutes,
    validUntil,
    customDays,
    dailyUnitPrice,
    description,
    createdAt,
    closedAt,
  };
}

function parseAquaparkEntries(value: unknown): AquaparkEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<AquaparkEntry[]>((entries, rawEntry) => {
    const entry = normalizeImportedAquaparkEntry(rawEntry);
    return entry && !entries.some((existing) => existing.id === entry.id) ? [...entries, entry] : entries;
  }, []);
}

function normalizeImportedDailySale(value: unknown): DailySale | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<DailySale>;
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : undefined;
  const amount = normalizePositiveMoney(candidate.amount);
  const createdAt = typeof candidate.createdAt === 'string' && !Number.isNaN(new Date(candidate.createdAt).getTime())
    ? candidate.createdAt
    : undefined;

  if (!id || !amount || !createdAt) {
    return null;
  }

  if (candidate.kind === 'beach_set' && Number.isInteger(candidate.setId) && (candidate.setId as number) >= 1 && (candidate.setId as number) <= TOTAL_SETS) {
    return { id, kind: 'beach_set', setId: candidate.setId as number, amount, createdAt };
  }

  if (candidate.kind === 'bed' && EXTRA_BED_IDS.includes(candidate.bedId as BedId)) {
    return { id, kind: 'bed', bedId: candidate.bedId as BedId, amount, createdAt };
  }

  if (
    candidate.kind === 'sunbed' &&
    typeof candidate.sunbedSaleId === 'string' &&
    Number.isSafeInteger(candidate.quantity) &&
    (candidate.quantity as number) > 0
  ) {
    return {
      id,
      kind: 'sunbed',
      sunbedSaleId: candidate.sunbedSaleId,
      quantity: candidate.quantity as number,
      amount,
      createdAt,
    };
  }

  if (
    candidate.kind === 'aquapark_entry' &&
    typeof candidate.entryId === 'string' &&
    isAquaparkTicketType(candidate.ticketType) &&
    Number.isSafeInteger(candidate.wristbandCount) &&
    (candidate.wristbandCount as number) > 0 &&
    normalizePositiveMoney(candidate.unitPrice)
  ) {
    return {
      id,
      kind: 'aquapark_entry',
      entryId: candidate.entryId,
      ticketType: candidate.ticketType,
      wristbandCount: candidate.wristbandCount as number,
      unitPrice: normalizePositiveMoney(candidate.unitPrice) as number,
      customDays: candidate.ticketType === 'custom_days' && Number.isSafeInteger(candidate.customDays) && (candidate.customDays as number) > 0
        ? candidate.customDays as number
        : undefined,
      amount,
      createdAt,
    };
  }

  return null;
}

function normalizeImportedSunbedSale(value: unknown): NonNumberedSunbedSale | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<NonNumberedSunbedSale>;
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : undefined;
  const quantity = Number.isSafeInteger(candidate.quantity) && (candidate.quantity as number) > 0
    ? candidate.quantity as number
    : undefined;
  const totalAmount = normalizePositiveMoney(candidate.totalAmount);
  const createdAt = typeof candidate.createdAt === 'string' && !Number.isNaN(new Date(candidate.createdAt).getTime())
    ? candidate.createdAt
    : undefined;

  return id && quantity && totalAmount && createdAt ? { id, quantity, totalAmount, createdAt } : null;
}

function parseSunbedSales(value: unknown): NonNumberedSunbedSale[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<NonNumberedSunbedSale[]>((sales, rawSale) => {
    const sale = normalizeImportedSunbedSale(rawSale);
    return sale && !sales.some((existing) => existing.id === sale.id) ? [...sales, sale] : sales;
  }, []);
}

function parseDailySales(value: unknown): DailySale[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<DailySale[]>((sales, rawSale) => {
    const sale = normalizeImportedDailySale(rawSale);
    return sale && !sales.some((existing) => existing.id === sale.id) ? [...sales, sale] : sales;
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
    const startDate = getLocalDateKey();
    const endDate = addDaysToDateKey(startDate, reservedDays - 1);
    const existing = beachReservations.find(
      (reservation) =>
        getSurnameKey(reservation.surname) === getSurnameKey(normalizedSurname) &&
        reservation.startDate === startDate &&
        reservation.endDate === endDate,
    );

    if (existing) {
      return existing;
    }

    const reservation = createBeachReservation({ surname: normalizedSurname, startDate, endDate });
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
    sunbedSales?: unknown;
    aquaparkEntries?: unknown;
    dailySales?: unknown;
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
    sunbedSales: parseSunbedSales(payload.sunbedSales),
    aquaparkEntries: parseAquaparkEntries(payload.aquaparkEntries),
    dailySales: parseDailySales(payload.dailySales),
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
        sunbedSales?: unknown;
        aquaparkEntries?: unknown;
        dailySales?: unknown;
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
          sunbedSales: parseSunbedSales(parsed.sunbedSales),
          aquaparkEntries: parseAquaparkEntries(parsed.aquaparkEntries),
          dailySales: parseDailySales(parsed.dailySales),
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
          sunbedSales: [],
          aquaparkEntries: [],
          dailySales: [],
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
          sunbedSales: [],
          aquaparkEntries: [],
          dailySales: [],
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
          sunbedSales: [],
          aquaparkEntries: [],
          dailySales: [],
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
        sunbedSales: [],
        aquaparkEntries: [],
        dailySales: [],
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
      ? { partialNote: undefined, price: undefined, priceMode: undefined, dailySaleId: undefined }
    : status === 'partial'
        ? { beachReservationId: undefined, surname: undefined, reservedDays: undefined, price: undefined, priceMode: undefined, dailySaleId: undefined }
        : status === 'paid'
          ? { beachReservationId: undefined, surname: undefined, reservedDays: undefined, partialNote: undefined }
          : { beachReservationId: undefined, surname: undefined, reservedDays: undefined, partialNote: undefined, price: undefined, priceMode: undefined, dailySaleId: undefined };

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
    status === 'reserved'
      ? { price: undefined, priceMode: undefined, dailySaleId: undefined }
      : status === 'paid'
        ? { beachReservationId: undefined, surname: undefined, reservedDays: undefined }
        : { beachReservationId: undefined, surname: undefined, reservedDays: undefined, price: undefined, priceMode: undefined, dailySaleId: undefined };

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
  return currentReservations;
}

function roundToNearestFiveMinutes(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.round(rounded.getMinutes() / 5) * 5);
  return rounded;
}

function isExtraTimeTicket(ticketType: AquaparkTicketType): boolean {
  return ticketType === '30min' || ticketType === '1hour' || ticketType === 'half_day';
}

function addAquaparkExtraTime(endAt: Date, startAt: Date, ticketType: AquaparkTicketType, extraMinutes: number): string {
  const extendedEnd = new Date(endAt);
  extendedEnd.setMinutes(extendedEnd.getMinutes() + extraMinutes);

  if (ticketType === 'half_day') {
    const closingTime = new Date(startAt);
    closingTime.setHours(20, 0, 0, 0);
    return (extendedEnd > closingTime ? closingTime : extendedEnd).toISOString();
  }

  return extendedEnd.toISOString();
}

function getAquaparkEntryTiming(ticketType: AquaparkTicketType, startAt: Date, customDays?: number, extraMinutes = 0) {
  const end = new Date(startAt);

  if (ticketType === 'one_week') {
    end.setDate(end.getDate() + 7);
    return { validUntil: end.toISOString() };
  }

  if (ticketType === 'custom_days' && customDays) {
    end.setDate(end.getDate() + customDays - 1);
    return { validUntil: end.toISOString() };
  }

  if (ticketType === '30min') {
    end.setMinutes(end.getMinutes() + 40);
    return { endAt: addAquaparkExtraTime(roundToNearestFiveMinutes(end), startAt, ticketType, extraMinutes) };
  }

  if (ticketType === '1hour') {
    end.setMinutes(end.getMinutes() + 70);
    return { endAt: addAquaparkExtraTime(roundToNearestFiveMinutes(end), startAt, ticketType, extraMinutes) };
  }

  if (ticketType === 'half_day') {
    end.setHours(end.getHours() + 6);
    const roundedEnd = roundToNearestFiveMinutes(end);
    const closingTime = new Date(startAt);
    closingTime.setHours(20, 0, 0, 0);
    const normalEnd = roundedEnd > closingTime ? closingTime : roundedEnd;
    return { endAt: addAquaparkExtraTime(normalEnd, startAt, ticketType, extraMinutes) };
  }

  end.setHours(20, 0, 0, 0);
  return { endAt: end.toISOString() };
}

function createAquaparkEntry(details: AquaparkEntryDetails): AquaparkEntry {
  const start = new Date();
  const ticket = AQUAPARK_TICKETS[details.ticketType];
  const customDays = details.ticketType === 'custom_days' ? details.customDays : undefined;
  const customDailyUnitPrice = details.ticketType === 'custom_days'
    ? normalizePositiveMoney(details.dailyUnitPrice)
    : undefined;
  const specialPrice = normalizePositiveMoney(details.specialPrice);
  const extraMinutes = isExtraTimeTicket(details.ticketType) && Number.isSafeInteger(details.extraMinutes) && (details.extraMinutes as number) >= 0
    ? details.extraMinutes as number
    : 0;
  const unitPrice = customDailyUnitPrice ?? specialPrice ?? ticket.price;
  const quantityMultiplier = details.ticketType === 'custom_days' ? customDays ?? 1 : 1;
  const hasCustomPriceOverride = details.ticketType === 'custom_days' && customDailyUnitPrice !== undefined && customDailyUnitPrice !== ticket.price;

  return {
    id: createReservationId('aquapark-entry'),
    wristbands: details.wristbands,
    ticketType: details.ticketType,
    defaultUnitPrice: ticket.price,
    unitPrice,
    totalPrice: Math.round(details.wristbands.length * quantityMultiplier * unitPrice * 100) / 100,
    priceMode: hasCustomPriceOverride || specialPrice ? 'special' : 'default',
    status: 'active',
    startAt: start.toISOString(),
    ...getAquaparkEntryTiming(details.ticketType, start, customDays, extraMinutes),
    extraMinutes,
    customDays,
    dailyUnitPrice: details.ticketType === 'custom_days' ? unitPrice : undefined,
    description: details.description?.trim() || undefined,
    createdAt: start.toISOString(),
  };
}

function isAquaparkEntryExpired(entry: AquaparkEntry, currentTime: Date): boolean {
  const expiryTime = entry.ticketType === 'one_week' || entry.ticketType === 'custom_days'
    ? entry.validUntil
    : entry.endAt;
  return expiryTime ? currentTime.getTime() > new Date(expiryTime).getTime() : false;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function parseWristbandNumbers(value: string): { wristbands: number[]; error?: string } {
  const parts = value.trim().split(/[\s,]+/).filter(Boolean);

  if (!parts.length || parts.some((part) => !/^\d+$/.test(part))) {
    return { wristbands: [], error: 'Enter one or more positive wristband numbers, separated by commas or spaces.' };
  }

  const wristbands = [...new Set(parts.map(Number))];
  return wristbands.every((wristband) => Number.isSafeInteger(wristband) && wristband > 0)
    ? { wristbands }
    : { wristbands: [], error: 'Wristband numbers must be positive whole numbers.' };
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
    sunbedSales: [],
    dailySales: [],
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
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      totalAmountPaid: reservation.totalAmountPaid,
      notes: reservation.notes,
      assignmentLabel: formatBeachAssignmentLabel(assignments),
    };
  }).sort(
    (first, second) => first.endDate.localeCompare(second.endDate) || first.surname.localeCompare(second.surname),
  );
}

function createBackupPayload(appData: AppData): BackupPayload {
  return {
    app: 'Beach Set Manager',
    version: 10,
    exportedAt: new Date().toISOString(),
    sets: appData.sets,
    extraBeds: appData.extraBeds,
    beachReservations: appData.beachReservations,
    savedSurnames: appData.savedSurnames,
    sunbedSales: appData.sunbedSales,
    aquaparkEntries: appData.aquaparkEntries,
    dailySales: appData.dailySales,
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
  const [sunbedSales, setSunbedSales] = useState<NonNumberedSunbedSale[]>(
    () => initialAppData.sunbedSales,
  );
  const [aquaparkEntries, setAquaparkEntries] = useState<AquaparkEntry[]>(
    () => initialAppData.aquaparkEntries,
  );
  const [dailySales, setDailySales] = useState<DailySale[]>(() => initialAppData.dailySales);
  const [currentTime, setCurrentTime] = useState(() => new Date());
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
        sunbedSales,
        aquaparkEntries,
        dailySales,
        lastAutomaticResetDate,
      }),
    );
  }, [sets, extraBeds, beachReservations, savedSurnames, sunbedSales, aquaparkEntries, dailySales, lastAutomaticResetDate]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
  const activeBeachReservation =
    activeEditor?.kind === 'beachReservation'
      ? beachReservations.find((reservation) => reservation.id === activeEditor.id) ?? null
      : null;
  const activeSunbedSale = activeEditor?.kind === 'sunbedSale' && activeEditor.id
    ? sunbedSales.find((sale) => sale.id === activeEditor.id) ?? null
    : null;

  function completeDailyReset(resetDate: string, message?: string) {
    lastAutomaticResetDateRef.current = resetDate;
    setLastAutomaticResetDate(resetDate);
    setSets((currentSets) => applyDailyResetToSets(currentSets));
    setExtraBeds((currentBeds) => applyDailyResetToBeds(currentBeds));
      setBeachReservations((currentReservations) => applyDailyResetToBeachReservations(currentReservations));
    setSunbedSales([]);
    setDailySales([]);
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
    if (tabId === 'aquapark' || tabId === 'sunbeds' || tabId === 'report') {
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

  function openNewAquaparkEntry() {
    setActiveEditor({ kind: 'aquaparkEntry' });
  }

  function openNewSunbedSale() {
    setActiveEditor({ kind: 'sunbedSale' });
  }

  function openSunbedSale(saleId: string) {
    setActiveEditor({ kind: 'sunbedSale', id: saleId });
  }

  function openBeachReservation(reservationId: string) {
    setActiveEditor({ kind: 'beachReservation', id: reservationId });
  }

  function closeEditor() {
    setActiveEditor(null);
  }

  function saveSet(setId: number, status: SetStatus, details?: Partial<BeachSet>) {
    const price = status === 'paid' ? normalizePositiveMoney(details?.price) : undefined;
    const existingSaleId = sets[setId].dailySaleId;
    const dailySaleId = status === 'paid' && price ? existingSaleId ?? createReservationId('beach-sale') : undefined;

    if (status === 'paid' && price && dailySaleId) {
      const now = new Date().toISOString();
      setDailySales((currentSales) => {
        const existingSale = currentSales.find((sale) => sale.id === dailySaleId);

        if (existingSale?.kind === 'beach_set') {
          return currentSales.map((sale) => sale.id === dailySaleId ? { ...sale, amount: price } : sale);
        }

        return [...currentSales, { id: dailySaleId, kind: 'beach_set', setId, amount: price, createdAt: now }];
      });
    }

    setSets((currentSets) => ({
      ...currentSets,
      [setId]: updateSetStatus(currentSets[setId], status, { ...details, dailySaleId }),
    }));
  }

  function saveBed(bedId: BedId, status: BedStatus, details?: Partial<ExtraBed>) {
    const price = status === 'paid' ? normalizePositiveMoney(details?.price) : undefined;
    const existingSaleId = extraBeds[bedId].dailySaleId;
    const dailySaleId = status === 'paid' && price ? existingSaleId ?? createReservationId('bed-sale') : undefined;

    if (status === 'paid' && price && dailySaleId) {
      const now = new Date().toISOString();
      setDailySales((currentSales) => {
        const existingSale = currentSales.find((sale) => sale.id === dailySaleId);
        if (existingSale?.kind === 'bed') {
          return currentSales.map((sale) => sale.id === dailySaleId ? { ...sale, amount: price } : sale);
        }
        return [...currentSales, { id: dailySaleId, kind: 'bed', bedId, amount: price, createdAt: now }];
      });
    }

    setExtraBeds((currentBeds) => ({
      ...currentBeds,
      [bedId]: updateBedStatus(currentBeds[bedId], status, { ...details, dailySaleId }),
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
        reservedDays: getInclusiveDateDays(reservation.startDate, reservation.endDate),
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
        reservedDays: getInclusiveDateDays(reservation.startDate, reservation.endDate),
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
              startDate: details.startDate,
              endDate: details.endDate,
              totalAmountPaid: details.totalAmountPaid,
              paymentRecordedAt: reservation.paymentRecordedAt,
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

  function saveSunbedSale(details: { quantity: number; totalAmount: number }, saleId?: string) {
    const now = new Date().toISOString();
    const id = saleId ?? createReservationId('sunbed-sale');
    const sale: NonNumberedSunbedSale = { id, quantity: details.quantity, totalAmount: details.totalAmount, createdAt: now };

    setSunbedSales((currentSales) => saleId
      ? currentSales.map((currentSale) => currentSale.id === saleId ? { ...sale, createdAt: currentSale.createdAt } : currentSale)
      : [sale, ...currentSales],
    );
    setDailySales((currentSales) => {
      const existing = currentSales.find((currentSale) => currentSale.id === id);
      if (existing?.kind === 'sunbed') {
        return currentSales.map((currentSale) => currentSale.id === id
          ? { ...currentSale, quantity: details.quantity, amount: details.totalAmount }
          : currentSale,
        );
      }
      return [...currentSales, { id, kind: 'sunbed', sunbedSaleId: id, quantity: details.quantity, amount: details.totalAmount, createdAt: now }];
    });
    closeEditor();
  }

  function deleteSunbedSale(saleId: string) {
    if (!window.confirm('Delete this sunbed sale?')) {
      return;
    }
    setSunbedSales((currentSales) => currentSales.filter((sale) => sale.id !== saleId));
    setDailySales((currentSales) => currentSales.filter((sale) => sale.id !== saleId));
  }

  function saveAquaparkEntry(details: AquaparkEntryDetails) {
    const conflictingEntries = aquaparkEntries.filter(
      (entry) =>
        entry.status === 'active' &&
        !isAquaparkEntryExpired(entry, new Date()) &&
        entry.wristbands.some((wristband) => details.wristbands.includes(wristband)),
    );

    if (conflictingEntries.length) {
      const conflictingWristbands = [...new Set(
        conflictingEntries.flatMap((entry) => entry.wristbands.filter((wristband) => details.wristbands.includes(wristband))),
      )].join(', ');
      const confirmed = window.confirm(
        `Wristband ${conflictingWristbands} is already active in the Aquapark tracker. Create another entry anyway?`,
      );

      if (!confirmed) {
        return;
      }
    }

    const entry = createAquaparkEntry(details);
    setAquaparkEntries((currentEntries) => [entry, ...currentEntries]);
    setDailySales((currentSales) => [
      ...currentSales,
      {
        id: createReservationId('aquapark-sale'),
        kind: 'aquapark_entry',
        entryId: entry.id,
        ticketType: entry.ticketType,
        wristbandCount: entry.wristbands.length,
        unitPrice: entry.unitPrice,
        customDays: entry.customDays,
        amount: entry.totalPrice,
        createdAt: entry.createdAt,
      },
    ]);
    closeEditor();
  }

  function deleteAquaparkEntry(entryId: string) {
    const confirmed = window.confirm('Close this Aquapark wristband entry? It will remain in today\'s sales report.');

    if (confirmed) {
      setAquaparkEntries((currentEntries) =>
        currentEntries.map((entry) => (
          entry.id === entryId ? { ...entry, status: 'closed', closedAt: new Date().toISOString() } : entry
        )),
      );
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
      sunbedSales,
      aquaparkEntries,
      dailySales,
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
        setSunbedSales(imported.sunbedSales);
        setAquaparkEntries(imported.aquaparkEntries);
        setDailySales(imported.dailySales);
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
        'Daily Reset will update all 56 sets, 4 extra beds, and the current-day sales report.',
        '',
        '- Paid sets and beds become free.',
        '- Partial sets become free.',
        '- Beach set and bed assignments are cleared.',
        '- Beach reservation date ranges are preserved.',
        '- Non-numbered Sunbed sales are cleared.',
        '- Current-day recorded sales are cleared for the new report.',
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
      setSunbedSales([]);
      setAquaparkEntries([]);
      setDailySales([]);
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
        <div className="topbar-actions">
          <button className="report-button" type="button" onClick={() => selectTab('report')}>
            Report
          </button>
          <button className="reset-button" type="button" onClick={resetDay}>
            Daily Reset
          </button>
        </div>
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

      {activeTab === 'sunbeds' ? (
        <SunbedsPage
          sales={sunbedSales}
          onCreateSale={openNewSunbedSale}
          onEditSale={openSunbedSale}
          onDeleteSale={deleteSunbedSale}
        />
      ) : activeTab === 'aquapark' ? (
        <AquaparkPage
          entries={aquaparkEntries}
          currentTime={currentTime}
          onCreateEntry={openNewAquaparkEntry}
          onDeleteEntry={deleteAquaparkEntry}
        />
      ) : activeTab === 'report' ? (
        <DailyReport sales={dailySales} reservations={beachReservations} />
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

      {activeEditor?.kind === 'aquaparkEntry' ? (
        <AquaparkEntryModal onClose={closeEditor} onSave={saveAquaparkEntry} />
      ) : null}

      {activeEditor?.kind === 'sunbedSale' ? (
        <SunbedSaleModal
          sale={activeSunbedSale}
          onClose={closeEditor}
          onSave={(details) => saveSunbedSale(details, activeSunbedSale?.id)}
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
                <span className="active-days">{formatDaysLeft(getInclusiveDateDays(reservation.startDate, reservation.endDate))}</span>
              </div>
              <p className="active-reservation-date">{formatReservationDates(reservation.startDate, reservation.endDate)}</p>
              {reservation.totalAmountPaid !== undefined ? <p className="active-reservation-paid">Paid: {formatEuro(reservation.totalAmountPaid)}</p> : null}
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
  const [startDate, setStartDate] = useState(reservation.startDate);
  const [endDate, setEndDate] = useState(reservation.endDate);
  const [totalAmountPaid, setTotalAmountPaid] = useState(
    reservation.totalAmountPaid === undefined ? '' : String(reservation.totalAmountPaid),
  );
  const [notes, setNotes] = useState(reservation.notes ?? '');
  const duration = getInclusiveDateDays(startDate, endDate);
  const parsedAmount = parsePositiveMoney(totalAmountPaid);
  const canSave = normalizeSurname(surname).length > 0 && duration > 0 && parsedAmount !== null;

  function save() {
    if (!canSave || parsedAmount === null) {
      return;
    }

    onSave({
      surname,
      startDate,
      endDate,
      totalAmountPaid: parsedAmount,
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
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              min={startDate}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <p className="reservation-duration">
            {duration ? formatDaysLeft(duration) : 'End date must be on or after the start date'}
          </p>
          <label>
            Total amount paid
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={totalAmountPaid}
              onChange={(event) => setTotalAmountPaid(event.target.value)}
              placeholder="e.g. 150"
            />
          </label>
          {parsedAmount === null ? <p className="field-error">Enter a paid amount greater than EUR 0 with at most 2 decimal places.</p> : null}
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

function SunbedsPage({
  sales,
  onCreateSale,
  onEditSale,
  onDeleteSale,
}: {
  sales: NonNumberedSunbedSale[];
  onCreateSale: () => void;
  onEditSale: (saleId: string) => void;
  onDeleteSale: (saleId: string) => void;
}) {
  const totalQuantity = sales.reduce((total, sale) => total + sale.quantity, 0);
  const totalRevenue = sales.reduce((total, sale) => total + sale.totalAmount, 0);

  return (
    <section className="sunbeds-page" aria-labelledby="sunbeds-heading">
      <header className="sunbeds-hero">
        <p className="eyebrow">Today</p>
        <h2 id="sunbeds-heading">Non-numbered Sunbeds</h2>
        <div className="sunbeds-totals">
          <span>Sunbeds sold<strong>{totalQuantity}</strong></span>
          <span>Total<strong>{formatEuro(totalRevenue)}</strong></span>
        </div>
        <button type="button" className="sunbeds-primary-button" onClick={onCreateSale}>New Sunbed Sale</button>
      </header>

      <section className="sunbed-sales-list" aria-labelledby="sunbed-sales-heading">
        <div className="sunbeds-section-heading">
          <div>
            <p className="eyebrow">Current-day sales</p>
            <h3 id="sunbed-sales-heading">Today's Sales ({sales.length})</h3>
          </div>
        </div>
        {sales.length ? sales.map((sale) => (
          <article className="sunbed-sale-card" key={sale.id}>
            <div>
              <p className="eyebrow">{formatTime(sale.createdAt)}</p>
              <strong>{sale.quantity} sunbeds</strong>
            </div>
            <strong>{formatEuro(sale.totalAmount)}</strong>
            <div className="sunbed-sale-actions">
              <button type="button" onClick={() => onEditSale(sale.id)}>Edit</button>
              <button type="button" onClick={() => onDeleteSale(sale.id)}>Delete</button>
            </div>
          </article>
        )) : <p className="report-empty">No Sunbed sales recorded today.</p>}
      </section>
    </section>
  );
}

function AquaparkPage({
  entries,
  currentTime,
  onCreateEntry,
  onDeleteEntry,
}: {
  entries: AquaparkEntry[];
  currentTime: Date;
  onCreateEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
}) {
  const activeEntries = entries.filter((entry) => entry.status === 'active');

  return (
    <section className="aquapark-page" aria-labelledby="aquapark-heading">
      <div className="aquapark-hero">
        <div>
          <p className="eyebrow">Operational ticket and wristband tracker</p>
          <h2 id="aquapark-heading">Aquapark</h2>
        </div>
        <div className="aquapark-hero-actions">
          <button type="button" className="aquapark-primary-button" onClick={onCreateEntry}>
            New Aquapark Entry
          </button>
        </div>
      </div>

      <section className="aquapark-tracker" aria-labelledby="aquapark-tracker-heading">
        <div className="aquapark-section-heading">
          <div>
            <p className="eyebrow">Operational tracker</p>
            <h3 id="aquapark-tracker-heading">Wristbands ({activeEntries.length})</h3>
          </div>
        </div>
        {activeEntries.length ? (
          <div className="aquapark-entry-list">
            {activeEntries.map((entry) => (
              <AquaparkEntryCard
                key={entry.id}
                entry={entry}
                expired={isAquaparkEntryExpired(entry, currentTime)}
                onDelete={onDeleteEntry}
              />
            ))}
          </div>
        ) : (
          <div className="empty-aquapark">
            <strong>No active wristband entries</strong>
            <span>Use New Aquapark Entry to track timed tickets and wristband numbers.</span>
          </div>
        )}
      </section>
    </section>
  );
}

function AquaparkEntryCard({
  entry,
  expired,
  onDelete,
}: {
  entry: AquaparkEntry;
  expired: boolean;
  onDelete: (entryId: string) => void;
}) {
  const isMultiDay = entry.ticketType === 'one_week' || entry.ticketType === 'custom_days';
  const priceDetail = entry.isLegacyPrice
    ? `Legacy total: ${formatEuro(entry.totalPrice)}`
    : entry.ticketType === 'custom_days'
      ? `${entry.wristbands.length} x ${entry.customDays ?? 1} days x ${formatEuro(entry.dailyUnitPrice ?? entry.unitPrice)}`
      : `${entry.wristbands.length} x ${formatEuro(entry.unitPrice)}`;

  return (
    <article className={`aquapark-entry-card${expired ? ' expired' : ''}`}>
      <div className="aquapark-entry-card-main">
        <div>
          <p className="eyebrow">Wristbands</p>
          <h4>{entry.wristbands.join(', ')}</h4>
        </div>
        <span className="aquapark-price-badge">Total {formatEuro(entry.totalPrice)}</span>
      </div>
      <p className="aquapark-ticket-label">{AQUAPARK_TICKETS[entry.ticketType].label}</p>
      <p className="aquapark-price-detail">{priceDetail}</p>
      {isMultiDay ? (
        <div className="aquapark-entry-times">
          <span><strong>Start</strong>{formatDate(entry.startAt)}</span>
          <span><strong>{entry.ticketType === 'custom_days' ? 'Custom Days' : 'Weekly'}</strong>{`Valid until: ${formatDate(entry.validUntil)}`}</span>
        </div>
      ) : (
        <div className="aquapark-entry-times">
          <span><strong>Start</strong>{formatTime(entry.startAt)}</span>
          <span><strong>End</strong>{formatTime(entry.endAt ?? entry.startAt)}</span>
        </div>
      )}
      {entry.extraMinutes > 0 ? <p className="aquapark-extra-time">Extra time: +{entry.extraMinutes} min</p> : null}
      {entry.description ? (
        <div className="aquapark-entry-description">
          <strong>Description</strong>
          <p>{entry.description}</p>
        </div>
      ) : null}
      {expired ? <p className="aquapark-expired-label">Expired</p> : null}
      <button type="button" className="aquapark-entry-close" onClick={() => onDelete(entry.id)}>
        Close Entry
      </button>
    </article>
  );
}

function getDailyReport(sales: DailySale[], reservations: BeachReservation[], today = getLocalDateKey()) {
  const beachSales = sales.filter((sale): sale is Extract<DailySale, { kind: 'beach_set' }> => sale.kind === 'beach_set');
  const bedSales = sales.filter((sale): sale is Extract<DailySale, { kind: 'bed' }> => sale.kind === 'bed');
  const sunbedSales = sales.filter((sale): sale is Extract<DailySale, { kind: 'sunbed' }> => sale.kind === 'sunbed');
  const aquaparkSales = sales.filter((sale): sale is Extract<DailySale, { kind: 'aquapark_entry' }> => sale.kind === 'aquapark_entry');
  const beachTotal = beachSales.reduce((total, sale) => total + sale.amount, 0);
  const bedTotal = bedSales.reduce((total, sale) => total + sale.amount, 0);
  const sunbedTotal = sunbedSales.reduce((total, sale) => total + sale.amount, 0);
  const reservationPayments = reservations.filter(
    (reservation) =>
      reservation.totalAmountPaid !== undefined &&
      reservation.totalAmountPaid > 0 &&
      reservation.paymentRecordedAt !== undefined &&
      getLocalDateKey(new Date(reservation.paymentRecordedAt)) === today,
  );
  const reservationTotal = reservationPayments.reduce((total, reservation) => total + (reservation.totalAmountPaid ?? 0), 0);
  const aquaparkTotal = aquaparkSales.reduce((total, sale) => total + sale.amount, 0);
  const ticketBreakdown = (Object.keys(AQUAPARK_TICKETS) as AquaparkTicketType[]).map((ticketType) => {
    const ticketSales = aquaparkSales.filter((sale) => sale.ticketType === ticketType);
    return {
      ticketType,
      wristbandCount: ticketSales.reduce((total, sale) => total + sale.wristbandCount, 0),
      customDayCount: ticketSales.reduce((total, sale) => total + (sale.customDays ?? 0) * sale.wristbandCount, 0),
      total: ticketSales.reduce((total, sale) => total + sale.amount, 0),
    };
  });

  return {
    beachSales,
    bedSales,
    sunbedSales,
    reservationPayments,
    aquaparkSales,
    beachTotal,
    bedTotal,
    sunbedTotal,
    reservationTotal,
    aquaparkTotal,
    total: beachTotal + bedTotal + sunbedTotal + reservationTotal + aquaparkTotal,
    sunbedQuantity: sunbedSales.reduce((total, sale) => total + sale.quantity, 0),
    wristbandCount: aquaparkSales.reduce((total, sale) => total + sale.wristbandCount, 0),
    ticketBreakdown,
  };
}

function DailyReport({ sales, reservations }: { sales: DailySale[]; reservations: BeachReservation[] }) {
  const report = useMemo(() => getDailyReport(sales, reservations), [sales, reservations]);
  const today = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <section className="daily-report-page" aria-labelledby="daily-report-heading">
      <header className="report-hero">
        <p className="eyebrow">Sales recorded in Beach Set Manager</p>
        <h2 id="daily-report-heading">Daily Report</h2>
        <p>{today}</p>
        <div className="report-total">
          <span>Total</span>
          <strong>{formatEuro(report.total)}</strong>
        </div>
        <div className="report-summary-grid">
          <span>Beach Sets<strong>{formatEuro(report.beachTotal)}</strong><small>{report.beachSales.length} sales</small></span>
          <span>Beds<strong>{formatEuro(report.bedTotal)}</strong><small>{report.bedSales.length} sales</small></span>
          <span>Sunbeds<strong>{formatEuro(report.sunbedTotal)}</strong><small>{report.sunbedQuantity} sold</small></span>
          <span>Reservations<strong>{formatEuro(report.reservationTotal)}</strong><small>{report.reservationPayments.length} payments</small></span>
          <span>Aquapark<strong>{formatEuro(report.aquaparkTotal)}</strong><small>{report.wristbandCount} wristbands</small></span>
        </div>
      </header>

      <section className="report-section" aria-labelledby="beach-report-heading">
        <div className="report-section-heading">
          <div>
            <p className="eyebrow">Current-day priced sets</p>
            <h3 id="beach-report-heading">Beach ({report.beachSales.length})</h3>
          </div>
          <strong>{formatEuro(report.beachTotal)}</strong>
        </div>
        {report.beachSales.length ? (
          <div className="report-list">
            {report.beachSales.map((sale) => (
              <p key={sale.id}><span>Set {sale.setId}</span><strong>{formatEuro(sale.amount)}</strong></p>
            ))}
          </div>
        ) : <p className="report-empty">No current-day numbered set sales recorded.</p>}
      </section>

      <section className="report-section" aria-labelledby="reservation-report-heading">
        <div className="report-section-heading">
          <div>
            <p className="eyebrow">Payments recorded today</p>
            <h3 id="reservation-report-heading">Beach Reservations ({report.reservationPayments.length})</h3>
          </div>
          <strong>{formatEuro(report.reservationTotal)}</strong>
        </div>
        {report.reservationPayments.length ? (
          <div className="report-list">
            {report.reservationPayments.map((reservation) => (
              <p key={reservation.id}>
                <span>{reservation.surname}<small>{formatReservationDates(reservation.startDate, reservation.endDate)}</small></span>
                <strong>{formatEuro(reservation.totalAmountPaid ?? 0)}</strong>
              </p>
            ))}
          </div>
        ) : <p className="report-empty">No Beach reservation payments were recorded today.</p>}
      </section>

      <section className="report-section" aria-labelledby="bed-report-heading">
        <div className="report-section-heading">
          <div>
            <p className="eyebrow">Current-day priced beds</p>
            <h3 id="bed-report-heading">Beds ({report.bedSales.length})</h3>
          </div>
          <strong>{formatEuro(report.bedTotal)}</strong>
        </div>
        {report.bedSales.length ? (
          <div className="report-list">
            {report.bedSales.map((sale) => (
              <p key={sale.id}><span>Bed {sale.bedId}</span><strong>{formatEuro(sale.amount)}</strong></p>
            ))}
          </div>
        ) : <p className="report-empty">No current-day Bed sales recorded.</p>}
      </section>

      <section className="report-section" aria-labelledby="sunbed-report-heading">
        <div className="report-section-heading">
          <div>
            <p className="eyebrow">Individual sunbed sales</p>
            <h3 id="sunbed-report-heading">Sunbeds ({report.sunbedQuantity} sold)</h3>
          </div>
          <strong>{formatEuro(report.sunbedTotal)}</strong>
        </div>
        {report.sunbedSales.length ? (
          <div className="report-list">
            {report.sunbedSales.map((sale) => (
              <p key={sale.id}><span>{sale.quantity} sunbeds</span><strong>{formatEuro(sale.amount)}</strong></p>
            ))}
          </div>
        ) : <p className="report-empty">No current-day non-numbered Sunbed sales recorded.</p>}
      </section>

      <section className="report-section" aria-labelledby="aquapark-report-heading">
        <div className="report-section-heading">
          <div>
            <p className="eyebrow">Tracker entries created today</p>
            <h3 id="aquapark-report-heading">Aquapark ({report.wristbandCount} wristbands)</h3>
          </div>
          <strong>{formatEuro(report.aquaparkTotal)}</strong>
        </div>
        <div className="report-list">
          {report.ticketBreakdown.map((ticket) => (
            <p key={ticket.ticketType}>
              <span>
                {AQUAPARK_TICKETS[ticket.ticketType].label}
                <small>
                  {ticket.wristbandCount} wristbands{ticket.ticketType === 'custom_days' && ticket.customDayCount ? `, ${ticket.customDayCount} wristband-days` : ''}
                </small>
              </span>
              <strong>{formatEuro(ticket.total)}</strong>
            </p>
          ))}
        </div>
      </section>
    </section>
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
    { id: 'sunbeds', label: 'Sunbeds' },
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
        <small>{beachSet.price ? formatEuro(beachSet.price) : '2 beds + parasol'}</small>
      </span>
    );
  }

  if (beachSet.status === 'reserved') {
    const reservation = getLinkedBeachReservation(beachSet.beachReservationId, beachReservations);

    return (
      <span className="card-detail">
        <strong>Reserved</strong>
        <small>{reservation?.surname || beachSet.surname || 'Missing reservation'}</small>
        <small>{formatDays(reservation ? getInclusiveDateDays(reservation.startDate, reservation.endDate) : beachSet.reservedDays)}</small>
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
        <small>{bed.price ? formatEuro(bed.price) : 'Bed only'}</small>
      </span>
    );
  }

  if (bed.status === 'reserved') {
    const reservation = getLinkedBeachReservation(bed.beachReservationId, beachReservations);

    return (
      <span className="card-detail">
        <strong>Reserved</strong>
        <small>{reservation?.surname || bed.surname || 'Missing reservation'}</small>
        <small>{formatDays(reservation ? getInclusiveDateDays(reservation.startDate, reservation.endDate) : bed.reservedDays)}</small>
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
  const assignableReservations = beachReservations.filter((reservation) => reservation.endDate >= getLocalDateKey());
  const [assignmentMode, setAssignmentMode] = useState<'existing' | 'new'>(
    assignableReservations.length ? 'existing' : 'new',
  );
  const [selectedReservationId, setSelectedReservationId] = useState(
    currentBeachReservationId ?? assignableReservations[0]?.id ?? '',
  );
  const [surname, setSurname] = useState('');
  const [startDate, setStartDate] = useState(getLocalDateKey());
  const [endDate, setEndDate] = useState(getLocalDateKey());
  const [totalAmountPaid, setTotalAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const duration = getInclusiveDateDays(startDate, endDate);
  const parsedAmount = parsePositiveMoney(totalAmountPaid);
  const canCreateReservation = normalizeSurname(surname).length > 0 && duration > 0 && parsedAmount !== null;

  function getAssignmentLabel(reservationId: string) {
    return (
      beachReservationAssignments.find((assignment) => assignment.id === reservationId)?.assignmentLabel ??
      'Not assigned today'
    );
  }

  function assignExistingReservation() {
    const reservation = assignableReservations.find((candidate) => candidate.id === selectedReservationId);

    if (reservation) {
      onAssignReservation(reservation);
    }
  }

  function createNewReservation() {
    if (!canCreateReservation || parsedAmount === null) {
      return;
    }

    onCreateReservation({
      surname,
      startDate,
      endDate,
      totalAmountPaid: parsedAmount,
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
          disabled={!assignableReservations.length}
        >
          Choose Reservation
        </button>
        <button
          type="button"
          className={assignmentMode === 'new' ? 'quick-option selected reserved-choice' : 'quick-option'}
          onClick={() => setAssignmentMode('new')}
        >
          New Reservation
        </button>
      </div>

      {assignmentMode === 'existing' && assignableReservations.length ? (
        <>
          <div className="existing-reservation-list" aria-label="Active beach reservations">
            {assignableReservations.map((reservation) => {
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
                    <span>{formatDaysLeft(getInclusiveDateDays(reservation.startDate, reservation.endDate))}</span>
                  </span>
                  <span className="existing-reservation-option-dates">
                    {formatReservationDates(reservation.startDate, reservation.endDate)}
                    {reservation.totalAmountPaid !== undefined ? ` - Paid ${formatEuro(reservation.totalAmountPaid)}` : ''}
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
            Start date
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            End date
            <input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <p className="reservation-duration">
            {duration ? formatDaysLeft(duration) : 'End date must be on or after the start date'}
          </p>
          <label>
            Total amount paid
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={totalAmountPaid}
              onChange={(event) => setTotalAmountPaid(event.target.value)}
              placeholder="e.g. 150"
            />
          </label>
          {parsedAmount === null ? <p className="field-error">Enter a paid amount greater than EUR 0 with at most 2 decimal places.</p> : null}
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
  const [fixedTotal, setFixedTotal] = useState(set.priceMode === 'fixed' ? set.price ?? 0 : 0);
  const [priceMode, setPriceMode] = useState<SetPriceMode>(set.priceMode ?? 'fixed');
  const [specialPrice, setSpecialPrice] = useState(set.priceMode === 'special' && set.price ? String(set.price) : '');
  const parsedSpecialPrice = parsePositiveMoney(specialPrice);
  const finalPrice = priceMode === 'special' ? parsedSpecialPrice : fixedTotal > 0 ? fixedTotal : null;

  function saveAndClose(status: SetStatus, details?: Partial<BeachSet>) {
    onSave(status, details);
    onClose();
  }

  function savePartial() {
    saveAndClose('partial', {
      partialNote: partialNote.trim() || 'Partial payment',
    });
  }

  function savePaid() {
    if (!finalPrice) {
      return;
    }

    saveAndClose('paid', { price: finalPrice, priceMode });
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
          <button type="button" className="sheet-button paid-action" onClick={savePaid} disabled={!finalPrice}>
            {finalPrice ? `Save Paid Set (${formatEuro(finalPrice)})` : 'Choose a Price First'}
          </button>
          <button type="button" className="sheet-button reserved-action" onClick={() => setMode('reserved')}>
            Mark Reserved
          </button>
          <button type="button" className="sheet-button partial-action" onClick={() => setMode('partial')}>
            Mark Partial Payment
          </button>
        </div>

        <div className="detail-panel set-price-builder" aria-label="Set price builder">
          <div>
            <p className="eyebrow">Price</p>
            <strong className="price-total">Current total: {finalPrice ? formatEuro(finalPrice) : 'Choose a price'}</strong>
          </div>
          <div className="price-button-row">
            <button
              type="button"
              className="quick-option"
              onClick={() => {
                setPriceMode('fixed');
                setFixedTotal((currentTotal) => currentTotal + 4);
              }}
            >
              €4
            </button>
            <button
              type="button"
              className="quick-option"
              onClick={() => {
                setPriceMode('fixed');
                setFixedTotal((currentTotal) => currentTotal + 12);
              }}
            >
              €12
            </button>
            <button
              type="button"
              className={priceMode === 'special' ? 'quick-option selected' : 'quick-option'}
              onClick={() => setPriceMode('special')}
            >
              Special Price
            </button>
          </div>
          {priceMode === 'special' ? (
            <label>
              Special price in euros
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={specialPrice}
                onChange={(event) => setSpecialPrice(event.target.value)}
                placeholder="e.g. 10 or 17.50"
              />
            </label>
          ) : null}
          <button
            type="button"
            className="clear-price-button"
            onClick={() => {
              setFixedTotal(0);
              setPriceMode('fixed');
              setSpecialPrice('');
            }}
          >
            Clear Price
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
  const [fixedTotal, setFixedTotal] = useState(bed.priceMode === 'fixed' ? bed.price ?? 0 : 0);
  const [priceMode, setPriceMode] = useState<SetPriceMode>(bed.priceMode ?? 'fixed');
  const [specialPrice, setSpecialPrice] = useState(bed.priceMode === 'special' && bed.price ? String(bed.price) : '');
  const parsedSpecialPrice = parsePositiveMoney(specialPrice);
  const finalPrice = priceMode === 'special' ? parsedSpecialPrice : fixedTotal > 0 ? fixedTotal : null;

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
          <button type="button" className="sheet-button paid-action" onClick={() => finalPrice && saveAndClose('paid', { price: finalPrice, priceMode })} disabled={!finalPrice}>
            {finalPrice ? `Save Paid Bed (${formatEuro(finalPrice)})` : 'Choose a Price First'}
          </button>
          <button type="button" className="sheet-button reserved-action" onClick={() => setMode('reserved')}>
            Mark Reserved
          </button>
        </div>

        <div className="detail-panel set-price-builder" aria-label="Bed price builder">
          <div>
            <p className="eyebrow">Price</p>
            <strong className="price-total">Current total: {finalPrice ? formatEuro(finalPrice) : 'Choose a price'}</strong>
          </div>
          <div className="price-button-row">
            <button type="button" className="quick-option" onClick={() => { setPriceMode('fixed'); setFixedTotal((total) => total + 20); }}>EUR 20</button>
            <button type="button" className="quick-option" onClick={() => { setPriceMode('fixed'); setFixedTotal((total) => total + 40); }}>EUR 40</button>
            <button type="button" className={priceMode === 'special' ? 'quick-option selected' : 'quick-option'} onClick={() => setPriceMode('special')}>Special Price</button>
          </div>
          {priceMode === 'special' ? (
            <label>
              Special price in euros
              <input type="number" inputMode="decimal" min="0.01" step="0.01" value={specialPrice} onChange={(event) => setSpecialPrice(event.target.value)} placeholder="e.g. 50" />
            </label>
          ) : null}
          <button type="button" className="clear-price-button" onClick={() => { setFixedTotal(0); setPriceMode('fixed'); setSpecialPrice(''); }}>Clear Price</button>
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

function SunbedSaleModal({
  sale,
  onClose,
  onSave,
}: {
  sale: NonNumberedSunbedSale | null;
  onClose: () => void;
  onSave: (details: { quantity: number; totalAmount: number }) => void;
}) {
  const [quantity, setQuantity] = useState(String(sale?.quantity ?? 1));
  const [totalAmount, setTotalAmount] = useState(sale ? String(sale.totalAmount) : '');
  const parsedQuantity = Number(quantity);
  const parsedAmount = parsePositiveMoney(totalAmount);
  const canSave = Number.isInteger(parsedQuantity) && parsedQuantity > 0 && parsedAmount !== null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="action-sheet" role="dialog" aria-modal="true" aria-labelledby="sunbed-sale-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Non-numbered Sunbeds</p>
            <h2 id="sunbed-sale-title">{sale ? 'Edit Sunbed Sale' : 'New Sunbed Sale'}</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose}>Close</button>
        </header>
        <div className="detail-panel">
          <label>
            Quantity sold
            <input type="number" inputMode="numeric" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label>
            Total amount paid
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="e.g. 32" />
          </label>
          <button type="button" className="sheet-button sunbeds-primary-button" disabled={!canSave} onClick={() => {
            if (canSave && parsedAmount !== null) onSave({ quantity: parsedQuantity, totalAmount: parsedAmount });
          }}>
            Save Sunbed Sale
          </button>
        </div>
        <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
      </section>
    </div>
  );
}

function AquaparkEntryModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (details: AquaparkEntryDetails) => void;
}) {
  const [wristbandInput, setWristbandInput] = useState('');
  const [ticketType, setTicketType] = useState<AquaparkTicketType>('30min');
  const [useSpecialPrice, setUseSpecialPrice] = useState(false);
  const [specialPrice, setSpecialPrice] = useState('');
  const [customDays, setCustomDays] = useState('1');
  const [customDailyPrice, setCustomDailyPrice] = useState('15');
  const [extraMinutes, setExtraMinutes] = useState(0);
  const [description, setDescription] = useState('');
  const parsedWristbands = parseWristbandNumbers(wristbandInput);
  const parsedSpecialPrice = parsePositiveMoney(specialPrice);
  const ticket = AQUAPARK_TICKETS[ticketType];
  const quantity = parsedWristbands.wristbands.length;
  const parsedCustomDays = Number(customDays);
  const parsedCustomDailyPrice = parsePositiveMoney(customDailyPrice);
  const isCustomDays = ticketType === 'custom_days';
  const allowsExtraTime = isExtraTimeTicket(ticketType);
  const unitPrice = isCustomDays
    ? parsedCustomDailyPrice ?? ticket.price
    : useSpecialPrice && parsedSpecialPrice ? parsedSpecialPrice : ticket.price;
  const dayMultiplier = isCustomDays && Number.isInteger(parsedCustomDays) && parsedCustomDays > 0 ? parsedCustomDays : 1;
  const totalPrice = Math.round(quantity * dayMultiplier * unitPrice * 100) / 100;
  const canSave = parsedWristbands.wristbands.length > 0 &&
    (isCustomDays
      ? Number.isInteger(parsedCustomDays) && parsedCustomDays > 0 && parsedCustomDailyPrice !== null
      : !useSpecialPrice || parsedSpecialPrice !== null);

  function saveEntry() {
    if (!canSave) {
      return;
    }

    onSave({
      wristbands: parsedWristbands.wristbands,
      ticketType,
      specialPrice: useSpecialPrice ? parsedSpecialPrice ?? undefined : undefined,
      customDays: isCustomDays ? parsedCustomDays : undefined,
      dailyUnitPrice: isCustomDays ? parsedCustomDailyPrice ?? undefined : undefined,
      extraMinutes: allowsExtraTime ? extraMinutes : undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aquapark-entry-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Aquapark wristband tracker</p>
            <h2 id="aquapark-entry-title">New Aquapark Entry</h2>
          </div>
          <button type="button" className="close-button" aria-label="Close Aquapark entry form" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="detail-panel aquapark-entry-panel">
          <label>
            Wristband numbers
            <input
              type="text"
              value={wristbandInput}
              onChange={(event) => setWristbandInput(event.target.value)}
              placeholder="e.g. 34, 4, 5"
              aria-describedby="wristband-help"
            />
            <small id="wristband-help">Separate multiple wristbands with commas or spaces.</small>
          </label>
          {wristbandInput && parsedWristbands.error ? <p className="field-error">{parsedWristbands.error}</p> : null}

          <label>
            Ticket type
            <select value={ticketType} onChange={(event) => setTicketType(event.target.value as AquaparkTicketType)}>
              {(Object.keys(AQUAPARK_TICKETS) as AquaparkTicketType[]).map((type) => (
                <option key={type} value={type}>
                  {AQUAPARK_TICKETS[type].label} - {formatEuro(AQUAPARK_TICKETS[type].price)}
                </option>
              ))}
            </select>
          </label>

          <div className="aquapark-price-summary">
            <span>{isCustomDays ? 'Default daily price' : 'Default unit price'}</span>
            <strong>{formatEuro(ticket.price)}{isCustomDays ? '/day' : ''}</strong>
          </div>
          {isCustomDays ? (
            <>
              <label>
                Number of days
                <input type="number" inputMode="numeric" min="1" step="1" value={customDays} onChange={(event) => setCustomDays(event.target.value)} />
              </label>
              <label>
                Daily unit price in euros
                <input type="number" inputMode="decimal" min="0.01" step="0.01" value={customDailyPrice} onChange={(event) => setCustomDailyPrice(event.target.value)} />
              </label>
            </>
          ) : null}
          {!isCustomDays ? (
            <>
              <label className="special-price-toggle">
                <input
                  type="checkbox"
                  checked={useSpecialPrice}
                  onChange={(event) => setUseSpecialPrice(event.target.checked)}
                />
                Use Special Price
              </label>
              {useSpecialPrice ? (
                <label>
                  Special price in euros
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={specialPrice}
                    onChange={(event) => setSpecialPrice(event.target.value)}
                    placeholder="e.g. 10 or 17.50"
                  />
                </label>
              ) : null}
            </>
          ) : null}
          <p className="entry-final-price">
            {quantity
              ? isCustomDays
                ? `${quantity} wristband${quantity === 1 ? '' : 's'} x ${dayMultiplier} days x ${formatEuro(unitPrice)}`
                : `${quantity} wristband${quantity === 1 ? '' : 's'} x ${formatEuro(unitPrice)}`
              : 'Add wristbands to calculate the total'}
            <strong>Total {formatEuro(totalPrice)}</strong>
          </p>
          {allowsExtraTime ? (
            <div className="aquapark-extra-time-controls">
              <p>Extra time: +{extraMinutes} min</p>
              <div className="price-button-row">
                <button type="button" className="quick-option" onClick={() => setExtraMinutes((minutes) => minutes + 5)}>+5 min</button>
                <button type="button" className="clear-price-button" onClick={() => setExtraMinutes(0)}>Clear Extra Time</button>
              </div>
            </div>
          ) : null}
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional description / notes"
            />
          </label>
          <button type="button" className="sheet-button aquapark-save-action" onClick={saveEntry} disabled={!canSave}>
            Create Aquapark Entry
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
