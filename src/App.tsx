import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { AuthStatusPage, LoginPage } from './components/auth/LoginPage';
import {
  AQUAPARK_TICKETS,
  createBeachSet,
  createDefaultAppData,
  createExtraBed,
  createFreeBeachSets,
  createFreeExtraBeds,
  EXTRA_BED_IDS,
  getBeachForSet,
  getLocalDateKey,
  TOTAL_SETS,
} from './domain/appData';
import type {
  AppData,
  AquaparkEntry,
  AquaparkEntryDetails,
  AquaparkPriceMode,
  AquaparkTicketType,
  ArchivedDailyReport,
  BeachId,
  BeachReservation,
  BeachReservationDetails,
  BeachSet,
  BeachSetMap,
  BedId,
  BedStatus,
  DailySale,
  ExtraBed,
  ExtraBedMap,
  NonNumberedSunbedSale,
  ReservationSurname,
  SetPriceMode,
  SetStatus,
  Transaction,
  TransactionType,
} from './domain/appData';
import type { AuthenticatedUser } from './services/auth/authService';
import { useAuthSession } from './services/auth/useAuthSession';
import { useSharedAppData } from './services/shared-state/useSharedAppData';
import './App.css';

type TabId = 'beaches' | 'sunbeds' | 'aquapark' | 'settings';
type BeachShortcut = 'beach1' | 'beach2' | 'beds';
type SettingsView = 'menu' | 'transactions' | 'report';
type DetailMode = 'actions' | 'reserved';
type ActiveEditor =
  | { kind: 'set'; id: number }
  | { kind: 'bed'; id: BedId }
  | { kind: 'beachReservation'; id: string }
  | { kind: 'newBeachReservation' }
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
type BackupPayload = AppData & {
  app: 'Beach Set Manager';
  version: 12;
  exportedAt: string;
};

const STATUS_ORDER: SetStatus[] = ['free', 'paid', 'reserved', 'left'];
const BED_STATUS_ORDER: BedStatus[] = ['free', 'paid', 'reserved'];
const BEACH_ONE_UPPER_ROW = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
const BEACH_ONE_LOWER_ROW = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const STATUS_META: Record<SetStatus, { label: string; shortLabel: string }> = {
  free: { label: 'Free', shortLabel: 'Free' },
  paid: { label: 'Paid', shortLabel: 'Paid' },
  reserved: { label: 'Reserved', shortLabel: 'Reserved' },
  left: { label: 'Left', shortLabel: 'Left' },
};


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

function getReservationDaysLeft(startDate: string, endDate: string, today = getLocalDateKey()): number {
  const effectiveStartDate = today > startDate ? today : startDate;
  return getInclusiveDateDays(effectiveStartDate, endDate);
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
  return typeof value === 'string' && (STATUS_ORDER.includes(value as SetStatus) || value === 'partial');
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
    status: (value as { status?: unknown }).status === 'partial' ? 'free' : value.status,
    beachReservationId: value.beachReservationId,
    surname: value.surname,
    reservedDays: value.reservedDays,
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
    status: (value as { status?: unknown }).status === 'partial' ? 'free' : value.status,
    beachReservationId,
    surname: surname || undefined,
    reservedDays,
    price,
    priceMode: price ? priceMode : undefined,
    dailySaleId,
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
    returnedWristbands: Array.isArray(candidate.returnedWristbands)
      ? [...new Set(candidate.returnedWristbands.filter((wristband) => wristbands.includes(wristband)))]
      : [],
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

  const description = typeof candidate.description === 'string' ? candidate.description.trim() || undefined : undefined;
  return id && quantity && totalAmount && createdAt ? { id, quantity, totalAmount, description, createdAt } : null;
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

function legacySaleToTransaction(sale: DailySale): Transaction {
  if (sale.kind === 'beach_set') {
    return { id: sale.id, type: 'beach_set', amount: sale.amount, createdAt: sale.createdAt, resourceId: String(sale.setId), resourceLabel: `Set ${sale.setId}` };
  }
  if (sale.kind === 'bed') {
    return { id: sale.id, type: 'bed', amount: sale.amount, createdAt: sale.createdAt, resourceId: String(sale.bedId), resourceLabel: `Bed ${sale.bedId}` };
  }
  if (sale.kind === 'sunbed') {
    return { id: sale.id, type: 'sunbed', amount: sale.amount, createdAt: sale.createdAt, resourceId: sale.sunbedSaleId, resourceLabel: `${sale.quantity} sunbeds`, metadata: { quantity: sale.quantity } };
  }
  return {
    id: sale.id,
    type: 'aquapark',
    amount: sale.amount,
    createdAt: sale.createdAt,
    resourceId: sale.entryId,
    resourceLabel: `Wristbands (${sale.wristbandCount})`,
    metadata: { ticketType: sale.ticketType, wristbandCount: sale.wristbandCount, unitPrice: sale.unitPrice, customDays: sale.customDays },
  };
}

function normalizeImportedTransaction(value: unknown): Transaction | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Transaction>;
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : undefined;
  const amount = normalizePositiveMoney(candidate.amount);
  const createdAt = typeof candidate.createdAt === 'string' && !Number.isNaN(new Date(candidate.createdAt).getTime()) ? candidate.createdAt : undefined;
  const type: TransactionType | undefined = ['beach_set', 'bed', 'sunbed', 'beach_reservation', 'aquapark'].includes(candidate.type as string)
    ? candidate.type as TransactionType
    : undefined;
  const status = candidate.status === 'deleted' ? 'deleted' : 'active';
  const deletedAt = typeof candidate.deletedAt === 'string' && !Number.isNaN(new Date(candidate.deletedAt).getTime())
    ? candidate.deletedAt
    : undefined;
  if (!id || !amount || !createdAt || !type) return null;
  return {
    id,
    type,
    amount,
    createdAt,
    status,
    deletedAt: status === 'deleted' ? deletedAt ?? createdAt : undefined,
    resourceId: typeof candidate.resourceId === 'string' ? candidate.resourceId : undefined,
    resourceLabel: typeof candidate.resourceLabel === 'string' ? candidate.resourceLabel : undefined,
    description: typeof candidate.description === 'string' ? candidate.description : undefined,
    metadata: candidate.metadata && typeof candidate.metadata === 'object' && !Array.isArray(candidate.metadata) ? candidate.metadata : undefined,
  };
}

function parseTransactions(value: unknown, legacySales?: unknown): Transaction[] {
  const hasModernTransactionLedger = Array.isArray(value);
  const rawTransactions = hasModernTransactionLedger ? value : [];
  const transactions = rawTransactions.reduce<Transaction[]>((items, raw) => {
    const transaction = normalizeImportedTransaction(raw);
    return transaction && !items.some((item) => item.id === transaction.id) ? [...items, transaction] : items;
  }, []);
  // Only use dailySales for genuinely old data. An empty modern ledger is valid after sales were deleted.
  return hasModernTransactionLedger || !legacySales ? transactions : parseDailySales(legacySales).map(legacySaleToTransaction);
}

function isActiveTransaction(transaction: Transaction) {
  return transaction.status !== 'deleted';
}

function parseReportArchive(value: unknown): ArchivedDailyReport[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<ArchivedDailyReport[]>((reports, rawReport) => {
    if (!rawReport || typeof rawReport !== 'object') return reports;
    const candidate = rawReport as Partial<ArchivedDailyReport>;
    const date = isLocalDateKey(candidate.date) ? candidate.date : undefined;
    const archivedAt = typeof candidate.archivedAt === 'string' && !Number.isNaN(new Date(candidate.archivedAt).getTime())
      ? candidate.archivedAt
      : undefined;
    if (!date || !archivedAt || reports.some((report) => report.date === date)) return reports;

    const transactions = parseTransactions(candidate.transactions);
    return [...reports, { date, archivedAt, transactions }];
  }, []).sort((first, second) => second.date.localeCompare(first.date));
}

function archiveTransactionsForDate(
  archive: ArchivedDailyReport[],
  date: string | undefined,
  transactions: Transaction[],
): ArchivedDailyReport[] {
  if (!date || !isLocalDateKey(date) || archive.some((report) => report.date === date)) return archive;

  const report: ArchivedDailyReport = {
    date,
    archivedAt: new Date().toISOString(),
    transactions: transactions.map((transaction) => ({ ...transaction })),
  };

  return [report, ...archive]
    .sort((first, second) => second.date.localeCompare(first.date));
}

function addKnownReservationPaymentTransactions(transactions: Transaction[], reservations: BeachReservation[]): Transaction[] {
  const today = getLocalDateKey();
  const reservationTransactions = reservations
    .filter((reservation) => reservation.totalAmountPaid && reservation.paymentRecordedAt && getLocalDateKey(new Date(reservation.paymentRecordedAt)) === today)
    .filter((reservation) => !transactions.some((transaction) => transaction.type === 'beach_reservation' && transaction.resourceId === reservation.id))
    .map((reservation) => ({
      id: createReservationId('transaction'), type: 'beach_reservation' as const, amount: reservation.totalAmountPaid as number,
      createdAt: reservation.paymentRecordedAt as string, resourceId: reservation.id, resourceLabel: reservation.surname,
      description: formatReservationDates(reservation.startDate, reservation.endDate),
    }));
  return [...transactions, ...reservationTransactions];
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
    transactions?: unknown;
    reportArchive?: unknown;
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
    transactions: addKnownReservationPaymentTransactions(parseTransactions(payload.transactions, payload.dailySales), migratedBeachData.beachReservations),
    reportArchive: parseReportArchive(payload.reportArchive),
    lastAutomaticResetDate: normalizeResetDate(payload.lastAutomaticResetDate),
  };
}

function getSets(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function updateSetStatus(set: BeachSet, status: SetStatus, details: Partial<BeachSet> = {}): BeachSet {
  const clearedDetails =
    status === 'reserved'
      ? { price: undefined, priceMode: undefined, dailySaleId: undefined }
      : status === 'paid'
        ? { beachReservationId: undefined, surname: undefined, reservedDays: undefined }
        : status === 'left'
          ? { beachReservationId: undefined, surname: undefined, reservedDays: undefined, price: undefined, priceMode: undefined, dailySaleId: undefined }
          : { beachReservationId: undefined, surname: undefined, reservedDays: undefined, price: undefined, priceMode: undefined, dailySaleId: undefined };

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
    returnedWristbands: [],
  };
}

function isAquaparkEntryExpired(entry: AquaparkEntry, currentTime: Date): boolean {
  const expiryTime = entry.ticketType === 'one_week' || entry.ticketType === 'custom_days'
    ? entry.validUntil
    : entry.endAt;
  return expiryTime ? currentTime.getTime() >= new Date(expiryTime).getTime() : false;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function formatAuditTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
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
    reportArchive: archiveTransactionsForDate(appData.reportArchive, lastResetDate, appData.transactions),
    transactions: [],
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
    version: 12,
    exportedAt: new Date().toISOString(),
    sets: appData.sets,
    extraBeds: appData.extraBeds,
    beachReservations: appData.beachReservations,
    savedSurnames: appData.savedSurnames,
    sunbedSales: appData.sunbedSales,
    aquaparkEntries: appData.aquaparkEntries,
    transactions: appData.transactions,
    reportArchive: appData.reportArchive,
    lastAutomaticResetDate: appData.lastAutomaticResetDate,
  };
}

function OperationalApp({
  initialSharedAppData,
  sharedRevision,
  sharedSyncStatus,
  onAppDataChange,
  authenticatedUser,
  authActionError,
  signOutPending,
  onSignOut,
}: {
  initialSharedAppData: AppData;
  sharedRevision: number;
  sharedSyncStatus: 'saved' | 'saving';
  onAppDataChange: (nextState: AppData) => void;
  authenticatedUser: AuthenticatedUser;
  authActionError: string | null;
  signOutPending: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [initialAppData] = useState(() => initializeAppDataForToday(initialSharedAppData));
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
  const [transactions, setTransactions] = useState<Transaction[]>(() => initialAppData.transactions);
  const [reportArchive, setReportArchive] = useState<ArchivedDailyReport[]>(() => initialAppData.reportArchive);
  const [reservationsCollapsed, setReservationsCollapsed] = useState(() => window.localStorage.getItem('beach-reservations-collapsed') === 'true');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [lastAutomaticResetDate, setLastAutomaticResetDate] = useState(
    () => initialAppData.lastAutomaticResetDate ?? getLocalDateKey(),
  );
  const [activeTab, setActiveTab] = useState<TabId>('beaches');
  const [settingsView, setSettingsView] = useState<SettingsView>('menu');
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const beachOneRef = useRef<HTMLElement | null>(null);
  const beachTwoRef = useRef<HTMLElement | null>(null);
  const bedsRef = useRef<HTMLElement | null>(null);
  const lastAutomaticResetDateRef = useRef(lastAutomaticResetDate);
  const transactionsRef = useRef(transactions);

  useEffect(() => {
    onAppDataChange({
      sets,
      extraBeds,
      beachReservations,
      savedSurnames,
      sunbedSales,
      aquaparkEntries,
      transactions,
      reportArchive,
      lastAutomaticResetDate,
    });
  }, [sets, extraBeds, beachReservations, savedSurnames, sunbedSales, aquaparkEntries, transactions, reportArchive, lastAutomaticResetDate, onAppDataChange]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    window.localStorage.setItem('beach-reservations-collapsed', String(reservationsCollapsed));
  }, [reservationsCollapsed]);

  useEffect(() => {
    // Installed PWAs may honor this lock; browsers that do not retain the compact portrait CSS layout.
    void window.screen.orientation?.lock?.('portrait').catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = useMemo(() => {
    return STATUS_ORDER.reduce(
      (summary, status) => ({
        ...summary,
        [status]: Object.values(sets).filter((set) => set.status === status).length + Object.values(extraBeds).filter((bed) => bed.status === status).length,
      }),
      {} as Record<SetStatus, number>,
    );
  }, [sets, extraBeds]);

  const beachReservationSummaries = useMemo(
    () => getBeachReservations(beachReservations, sets, extraBeds),
    [beachReservations, sets, extraBeds],
  );
  const setRevenue = useMemo(() => Object.fromEntries(
    Object.values(sets).map((set) => [set.id, transactions.filter((transaction) => isActiveTransaction(transaction) && transaction.type === 'beach_set' && transaction.resourceId === String(set.id)).reduce((total, transaction) => total + transaction.amount, 0)]),
  ) as Record<number, number>, [sets, transactions]);

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
    const closingDate = lastAutomaticResetDateRef.current;
    const closingTransactions = transactionsRef.current;
    setReportArchive((currentArchive) => archiveTransactionsForDate(currentArchive, closingDate, closingTransactions));
    lastAutomaticResetDateRef.current = resetDate;
    setLastAutomaticResetDate(resetDate);
    setSets((currentSets) => applyDailyResetToSets(currentSets));
    setExtraBeds((currentBeds) => applyDailyResetToBeds(currentBeds));
      setBeachReservations((currentReservations) => applyDailyResetToBeachReservations(currentReservations));
    setSunbedSales([]);
    setTransactions([]);
    transactionsRef.current = [];
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

  function scrollToBeachSection(section: BeachShortcut) {
    const target = section === 'beach1' ? beachOneRef.current : section === 'beach2' ? beachTwoRef.current : bedsRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectTab(tabId: TabId) {
    setActiveTab(tabId);
    if (tabId === 'settings') setSettingsView('menu');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function selectBeachShortcut(section: BeachShortcut) {
    if (activeTab === 'beaches') {
      scrollToBeachSection(section);
      return;
    }
    setActiveTab('beaches');
    window.requestAnimationFrame(() => scrollToBeachSection(section));
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

  function openNewBeachReservation() {
    setActiveEditor({ kind: 'newBeachReservation' });
  }

  function closeEditor() {
    setActiveEditor(null);
  }

  function saveSet(setId: number, status: SetStatus, details?: Partial<BeachSet>) {
    const price = status === 'paid' ? normalizePositiveMoney(details?.price) : undefined;
    const transaction = price ? {
      id: createReservationId('transaction'), type: 'beach_set' as const, amount: price, createdAt: new Date().toISOString(),
      resourceId: String(setId), resourceLabel: `Set ${setId}`,
    } : undefined;

    if (transaction) {
      setTransactions((currentTransactions) => [...currentTransactions, transaction]);
    }

    setSets((currentSets) => ({
      ...currentSets,
      [setId]: updateSetStatus(
        currentSets[setId],
        status,
        transaction ? { ...details, dailySaleId: transaction.id } : details,
      ),
    }));
  }

  function saveBed(bedId: BedId, status: BedStatus, details?: Partial<ExtraBed>) {
    const price = status === 'paid' ? normalizePositiveMoney(details?.price) : undefined;
    const transaction = price ? {
      id: createReservationId('transaction'), type: 'bed' as const, amount: price, createdAt: new Date().toISOString(),
      resourceId: String(bedId), resourceLabel: `Bed ${bedId}`,
    } : undefined;

    if (transaction) {
      setTransactions((currentTransactions) => [...currentTransactions, transaction]);
    }

    setExtraBeds((currentBeds) => ({
      ...currentBeds,
      [bedId]: updateBedStatus(
        currentBeds[bedId],
        status,
        transaction ? { ...details, dailySaleId: transaction.id } : details,
      ),
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
    if (reservation.totalAmountPaid !== undefined && reservation.paymentRecordedAt) {
      const amount = reservation.totalAmountPaid;
      const createdAt = reservation.paymentRecordedAt;
      setTransactions((currentTransactions) => [...currentTransactions, {
        id: createReservationId('transaction'), type: 'beach_reservation', amount, createdAt, resourceId: reservation.id, resourceLabel: reservation.surname,
        description: formatReservationDates(reservation.startDate, reservation.endDate),
      }]);
    }
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
    if (reservation.totalAmountPaid !== undefined && reservation.paymentRecordedAt) {
      const amount = reservation.totalAmountPaid;
      const createdAt = reservation.paymentRecordedAt;
      setTransactions((currentTransactions) => [...currentTransactions, {
        id: createReservationId('transaction'), type: 'beach_reservation', amount, createdAt, resourceId: reservation.id, resourceLabel: reservation.surname,
        description: formatReservationDates(reservation.startDate, reservation.endDate),
      }]);
    }
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
    const existing = beachReservations.find((reservation) => reservation.id === reservationId);
    if (existing?.paymentRecordedAt && getLocalDateKey(new Date(existing.paymentRecordedAt)) === getLocalDateKey()) {
      setTransactions((currentTransactions) => currentTransactions.map((transaction) =>
        transaction.type === 'beach_reservation' && transaction.resourceId === reservationId
          ? { ...transaction, amount: details.totalAmountPaid ?? transaction.amount, resourceLabel: surname, description: formatReservationDates(details.startDate, details.endDate) }
          : transaction,
      ));
    }
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

  function createUnassignedBeachReservation(details: BeachReservationDetails) {
    const surname = normalizeSurname(details.surname);
    if (!surname) return;
    const reservation = createBeachReservation({ ...details, surname });
    saveReservationSurname(reservation.surname);
    setBeachReservations((currentReservations) => [reservation, ...currentReservations]);
    if (reservation.totalAmountPaid !== undefined && reservation.paymentRecordedAt) {
      const amount = reservation.totalAmountPaid;
      const createdAt = reservation.paymentRecordedAt;
      setTransactions((currentTransactions) => [...currentTransactions, {
        id: createReservationId('transaction'), type: 'beach_reservation', amount, createdAt, resourceId: reservation.id, resourceLabel: reservation.surname,
        description: formatReservationDates(reservation.startDate, reservation.endDate),
      }]);
    }
    closeEditor();
  }

  function deleteSavedSurname(surname: string) {
    setSavedSurnames((currentSurnames) =>
      currentSurnames.filter((savedSurname) => getSurnameKey(savedSurname) !== getSurnameKey(surname)),
    );
  }

  function saveSunbedSale(details: { quantity: number; totalAmount: number; description?: string }, saleId?: string) {
    const now = new Date().toISOString();
    const id = saleId ?? createReservationId('sunbed-sale');
    const sale: NonNumberedSunbedSale = { id, quantity: details.quantity, totalAmount: details.totalAmount, description: details.description?.trim() || undefined, createdAt: now };

    setSunbedSales((currentSales) => saleId
      ? currentSales.map((currentSale) => currentSale.id === saleId ? { ...sale, createdAt: currentSale.createdAt } : currentSale)
      : [sale, ...currentSales],
    );
    setTransactions((currentTransactions) => {
      const existing = currentTransactions.find((transaction) => isActiveTransaction(transaction) && transaction.resourceId === id && transaction.type === 'sunbed');
      const transaction: Transaction = { id: existing?.id ?? createReservationId('transaction'), type: 'sunbed', amount: details.totalAmount, createdAt: existing?.createdAt ?? now, resourceId: id, resourceLabel: `${details.quantity} sunbeds`, metadata: { quantity: details.quantity } };
      return existing ? currentTransactions.map((item) => item.id === existing.id ? transaction : item) : [...currentTransactions, transaction];
    });
    closeEditor();
  }

  function deleteSunbedSale(saleId: string) {
    if (!window.confirm('Delete this sunbed sale?')) {
      return;
    }
    setSunbedSales((currentSales) => currentSales.filter((sale) => sale.id !== saleId));
    const deletedAt = new Date().toISOString();
    setTransactions((currentTransactions) => currentTransactions.map((transaction) =>
      transaction.type === 'sunbed' && transaction.resourceId === saleId && isActiveTransaction(transaction)
        ? { ...transaction, status: 'deleted', deletedAt }
        : transaction,
    ));
  }

  function saveAquaparkEntry(details: AquaparkEntryDetails) {
    const entry = createAquaparkEntry(details);
    setAquaparkEntries((currentEntries) => [
      entry,
      ...currentEntries.map((currentEntry) => {
        if (currentEntry.status !== 'active') return currentEntry;
        const reassignedWristbands = currentEntry.wristbands.filter(
          (wristband) => details.wristbands.includes(wristband) && !currentEntry.returnedWristbands.includes(wristband),
        );
        return reassignedWristbands.length
          ? { ...currentEntry, returnedWristbands: [...currentEntry.returnedWristbands, ...reassignedWristbands] }
          : currentEntry;
      }),
    ]);
    setTransactions((currentTransactions) => [...currentTransactions, {
      id: createReservationId('transaction'), type: 'aquapark', amount: entry.totalPrice, createdAt: entry.createdAt,
      resourceId: entry.id, resourceLabel: `Wristbands ${entry.wristbands.join(', ')}`,
      description: AQUAPARK_TICKETS[entry.ticketType].label,
      metadata: { ticketType: entry.ticketType, wristbandCount: entry.wristbands.length, unitPrice: entry.unitPrice, customDays: entry.customDays },
    }]);
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

  function toggleAquaparkWristbandReturn(entryId: string, wristband: number) {
    setAquaparkEntries((currentEntries) => currentEntries.map((entry) => entry.id !== entryId ? entry : {
      ...entry,
      returnedWristbands: entry.returnedWristbands.includes(wristband)
        ? entry.returnedWristbands.filter((value) => value !== wristband)
        : [...entry.returnedWristbands, wristband],
    }));
  }

  function removeBeachReservationAndAssignments(reservationId: string) {
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
  }

  function isLatestTransactionForResource(transaction: Transaction) {
    return transactions
      .filter((item) => isActiveTransaction(item) && item.type === transaction.type && item.resourceId === transaction.resourceId)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())[0]?.id === transaction.id;
  }

  function deleteTransaction(transactionId: string) {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) return;

    const reservation = transaction.type === 'beach_reservation'
      ? beachReservations.find((item) => item.id === transaction.resourceId)
      : undefined;
    const confirmationMessage = reservation
      ? `Delete reservation for ${reservation.surname}? This will also remove it from any assigned sets or beds.`
      : `Delete this ${transaction.type.replace('_', ' ')} transaction for ${formatEuro(transaction.amount)}?`;

    if (!window.confirm(confirmationMessage)) return;

    if (transaction.type === 'beach_set') {
      const setId = Number(transaction.resourceId);
      if (Number.isInteger(setId) && sets[setId]) {
        const isLegacyCurrentSale = !sets[setId].dailySaleId &&
          sets[setId].price === transaction.amount &&
          isLatestTransactionForResource(transaction);
        if (sets[setId].dailySaleId === transaction.id || isLegacyCurrentSale) {
          setSets((currentSets) => ({
            ...currentSets,
            [setId]: updateSetStatus(currentSets[setId], 'free'),
          }));
        }
      }
    } else if (transaction.type === 'bed') {
      const bedId = Number(transaction.resourceId) as BedId;
      if (EXTRA_BED_IDS.includes(bedId)) {
        const bed = extraBeds[bedId];
        const isLegacyCurrentSale = !bed.dailySaleId &&
          bed.price === transaction.amount &&
          isLatestTransactionForResource(transaction);
        if (bed.dailySaleId === transaction.id || isLegacyCurrentSale) {
          setExtraBeds((currentBeds) => ({
            ...currentBeds,
            [bedId]: updateBedStatus(currentBeds[bedId], 'free'),
          }));
        }
      }
    } else if (transaction.type === 'sunbed' && transaction.resourceId) {
      setSunbedSales((currentSales) => currentSales.filter((sale) => sale.id !== transaction.resourceId));
    } else if (transaction.type === 'aquapark' && transaction.resourceId) {
      setAquaparkEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== transaction.resourceId));
    } else if (transaction.type === 'beach_reservation' && transaction.resourceId) {
      removeBeachReservationAndAssignments(transaction.resourceId);
    }

    const deletedAt = new Date().toISOString();
    setTransactions((currentTransactions) => currentTransactions.map((item) =>
      item.id === transactionId ? { ...item, status: 'deleted', deletedAt } : item,
    ));
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

    removeBeachReservationAndAssignments(reservationId);
    const deletedAt = new Date().toISOString();
    setTransactions((currentTransactions) => currentTransactions.map((transaction) =>
      transaction.type === 'beach_reservation' && transaction.resourceId === reservationId && isActiveTransaction(transaction)
        ? { ...transaction, status: 'deleted', deletedAt }
        : transaction,
    ));
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
      transactions,
      reportArchive,
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
        'Import this backup and replace the current shared Petalon data? Other signed-in users will receive it automatically after it saves.',
      );

      if (confirmed) {
        setSets(imported.sets);
        setExtraBeds(imported.extraBeds);
        setBeachReservations(imported.beachReservations);
        setSavedSurnames(imported.savedSurnames);
        setSunbedSales(imported.sunbedSales);
        setAquaparkEntries(imported.aquaparkEntries);
        setTransactions(imported.transactions);
        transactionsRef.current = imported.transactions;
        setReportArchive(imported.reportArchive);
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
        '- The current Daily Report is saved in Report Archive.',
        '- Current-day recorded sales are then cleared for the new report.',
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
      'Danger: this clears the shared Petalon operational data for every signed-in user. Type RESET to continue.',
    );

    if (typed === 'RESET') {
      const defaults = createDefaultAppData();
      setSets(defaults.sets);
      setExtraBeds(defaults.extraBeds);
      setBeachReservations(defaults.beachReservations);
      setSavedSurnames(defaults.savedSurnames);
      setSunbedSales(defaults.sunbedSales);
      setAquaparkEntries(defaults.aquaparkEntries);
      setTransactions(defaults.transactions);
      transactionsRef.current = [];
      setReportArchive(defaults.reportArchive);
      const today = defaults.lastAutomaticResetDate ?? getLocalDateKey();
      lastAutomaticResetDateRef.current = today;
      setLastAutomaticResetDate(today);
      closeEditor();
      setBackupMessage('Shared Petalon app data reset; saving...');
    }
  }

  return (
    <main className={`app-shell tab-${activeTab}${activeTab === 'beaches' ? ' beaches-active' : ''}`}>
      <TopNavigation activeTab={activeTab} onSelectTab={selectTab} />
      <div className={`shared-sync-status shared-sync-${sharedSyncStatus}`} aria-live="polite">
        <span className="shared-sync-dot" aria-hidden="true" />
        {sharedSyncStatus === 'saving'
          ? 'Saving shared data...'
          : `Shared data saved - revision ${sharedRevision}`}
      </div>

      <div className="page-content">
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
          onToggleWristbandReturn={toggleAquaparkWristbandReturn}
        />
      ) : activeTab === 'settings' ? (
        <SettingsPage
          view={settingsView}
          backupMessage={backupMessage}
          importInputRef={importInputRef}
          savedSurnames={savedSurnames}
          onDailyReset={resetDay}
          onExport={exportBackup}
          onImport={openImportPicker}
          onImportFile={(file) => void importBackup(file)}
          onResetAppData={resetAppData}
          onDeleteSurname={deleteSavedSurname}
          onShowTransactions={() => setSettingsView('transactions')}
          onShowReport={() => setSettingsView('report')}
          onBackToSettings={() => setSettingsView('menu')}
          transactions={transactions}
          reportArchive={reportArchive}
          onDeleteTransaction={deleteTransaction}
          authenticatedUser={authenticatedUser}
          authActionError={authActionError}
          signOutPending={signOutPending}
          onSignOut={onSignOut}
        />
      ) : (
        <>
          <ActiveReservationsSection
            reservations={beachReservationSummaries}
            onCreateReservation={openNewBeachReservation}
            onEditReservation={openBeachReservation}
            onDeleteReservation={deleteBeachReservation}
            collapsed={reservationsCollapsed}
            onToggleCollapsed={() => setReservationsCollapsed((collapsed) => !collapsed)}
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
            setRevenue={setRevenue}
            onEditSet={openSetEditor}
          />
          <BeachTwo
            sectionRef={beachTwoRef}
            sets={sets}
            beachReservations={beachReservations}
            setRevenue={setRevenue}
            onEditSet={openSetEditor}
          />
          <ExtraBedsSection
            sectionRef={bedsRef}
            beds={extraBeds}
            beachReservations={beachReservations}
            onEditBed={openBedEditor}
          />
        </>
      )}
      </div>

      {activeTab === 'beaches' ? <BeachShortcuts onSelect={selectBeachShortcut} /> : null}

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

      {activeEditor?.kind === 'newBeachReservation' ? (
        <BeachReservationModal
          reservation={null}
          savedSurnames={savedSurnames}
          onClose={closeEditor}
          onSave={createUnassignedBeachReservation}
        />
      ) : null}

    </main>
  );
}

function BeachOne({
  sectionRef,
  sets,
  beachReservations,
  setRevenue,
  onEditSet,
}: {
  sectionRef: MutableRefObject<HTMLElement | null>;
  sets: BeachSetMap;
  beachReservations: BeachReservation[];
  setRevenue: Record<number, number>;
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
            setRevenue={setRevenue}
            onEditSet={onEditSet}
          />
          <SetRow
            label="Lower Row"
            sets={BEACH_ONE_LOWER_ROW}
            beachSets={sets}
            beachReservations={beachReservations}
            setRevenue={setRevenue}
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
  setRevenue,
  onEditSet,
}: {
  sectionRef: MutableRefObject<HTMLElement | null>;
  sets: BeachSetMap;
  beachReservations: BeachReservation[];
  setRevenue: Record<number, number>;
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
      <BeachHeader title="Beach 2" subtitle="Sets 21-56" />
      <div className="beach-two-path beach-map" aria-label="Beach 2 long beach path">
        <span className="path-cue start-cue">Start: Set 21</span>
        <span className="path-cue scroll-cue">Scroll to Set 56</span>
        <div className="beach-two-column">
          {getSets(21, 56).map((setNumber) => (
            <SetCard
              key={setNumber}
              beachSet={sets[setNumber]}
              beachReservations={beachReservations}
              revenue={setRevenue[setNumber]}
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
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="beach-header">
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h2 id={title === 'Beach 1' ? 'beach-one-heading' : 'beach-two-heading'}>{title}</h2>
      </div>
    </div>
  );
}

function SetRow({
  label,
  sets,
  beachSets,
  beachReservations,
  setRevenue,
  onEditSet,
}: {
  label: string;
  sets: number[];
  beachSets: BeachSetMap;
  beachReservations: BeachReservation[];
  setRevenue: Record<number, number>;
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
            revenue={setRevenue[setNumber]}
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
  revenue,
  onEdit,
}: {
  beachSet: BeachSet;
  beachReservations: BeachReservation[];
  revenue: number;
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
      <SetDetails beachSet={beachSet} beachReservations={beachReservations} revenue={revenue} />
    </button>
  );
}

function ExtraBedsSection({
  sectionRef,
  beds,
  beachReservations,
  onEditBed,
}: {
  sectionRef: MutableRefObject<HTMLElement | null>;
  beds: ExtraBedMap;
  beachReservations: BeachReservation[];
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
          <h2 id="extra-beds-heading">Extra Beds</h2>
        </div>
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
  onCreateReservation,
  onEditReservation,
  onDeleteReservation,
  collapsed,
  onToggleCollapsed,
}: {
  reservations: ActiveReservationSummary[];
  onCreateReservation: () => void;
  onEditReservation: (reservationId: string) => void;
  onDeleteReservation: (reservationId: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <section className="active-reservations" aria-labelledby="active-reservations-heading">
      <div className="active-reservations-header">
        <div>
          <p className="eyebrow">Reserved now</p>
          <h2 id="active-reservations-heading">Beach Reservations ({reservations.length})</h2>
        </div>
        <div className="active-reservations-header-actions">
          <button type="button" className="active-reservation-new" onClick={onCreateReservation}>New Reservation</button>
          <button type="button" className="active-reservations-toggle" onClick={onToggleCollapsed}>{collapsed ? 'Expand' : 'Collapse'}</button>
        </div>
      </div>

      {!collapsed && reservations.length ? (
        <div className="active-reservation-list">
          {reservations.map((reservation) => (
            <article className="active-reservation-card" key={reservation.id}>
              <div className="active-reservation-card-header">
                <strong>{reservation.surname}</strong>
                <span className="active-days">{formatDaysLeft(getReservationDaysLeft(reservation.startDate, reservation.endDate))}</span>
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
      ) : !collapsed ? (
        <p className="no-active-reservations">No active reservations.</p>
      ) : null}
    </section>
  );
}

function BeachReservationModal({
  reservation,
  savedSurnames,
  onClose,
  onSave,
}: {
  reservation: BeachReservation | null;
  savedSurnames: ReservationSurname[];
  onClose: () => void;
  onSave: (details: BeachReservationDetails) => void;
}) {
  const [surname, setSurname] = useState(reservation?.surname ?? '');
  const [startDate, setStartDate] = useState(reservation?.startDate ?? getLocalDateKey());
  const [endDate, setEndDate] = useState(reservation?.endDate ?? getLocalDateKey());
  const [totalAmountPaid, setTotalAmountPaid] = useState(
    reservation?.totalAmountPaid === undefined ? '' : String(reservation.totalAmountPaid),
  );
  const [notes, setNotes] = useState(reservation?.notes ?? '');
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
            <h2 id="beach-reservation-editor-title">{reservation ? 'Edit Reservation' : 'New Reservation'}</h2>
          </div>
          <button type="button" className="close-button" aria-label="Close reservation editor" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="detail-panel reservation-edit-panel">
          <SurnameInput
            inputId={reservation ? 'beach-reservation-edit-surname' : 'beach-reservation-new-surname'}
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
            {reservation ? 'Save Reservation' : 'Create Reservation'}
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
              {sale.description ? <p className="sunbed-sale-description">{sale.description}</p> : null}
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
  onToggleWristbandReturn,
}: {
  entries: AquaparkEntry[];
  currentTime: Date;
  onCreateEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onToggleWristbandReturn: (entryId: string, wristband: number) => void;
}) {
  const activeEntries = entries.filter((entry) => entry.status === 'active').sort((first, second) => {
    const firstOutstanding = first.wristbands.length - first.returnedWristbands.length;
    const secondOutstanding = second.wristbands.length - second.returnedWristbands.length;
    if (Boolean(firstOutstanding) !== Boolean(secondOutstanding)) return firstOutstanding ? -1 : 1;
    const firstExpired = isAquaparkEntryExpired(first, currentTime);
    const secondExpired = isAquaparkEntryExpired(second, currentTime);
    if (firstExpired !== secondExpired) return firstExpired ? -1 : 1;
    const firstEnd = new Date(first.endAt ?? first.validUntil ?? first.startAt).getTime();
    const secondEnd = new Date(second.endAt ?? second.validUntil ?? second.startAt).getTime();
    return firstEnd - secondEnd;
  });

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
                onToggleWristbandReturn={onToggleWristbandReturn}
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
  onToggleWristbandReturn,
}: {
  entry: AquaparkEntry;
  expired: boolean;
  onDelete: (entryId: string) => void;
  onToggleWristbandReturn: (entryId: string, wristband: number) => void;
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
          <div className="wristband-return-list">{entry.wristbands.map((wristband) => {
            const isReturned = entry.returnedWristbands.includes(wristband);

            return (
              <button
                type="button"
                key={wristband}
                className={isReturned ? 'returned-wristband' : ''}
                onClick={() => onToggleWristbandReturn(entry.id, wristband)}
                aria-pressed={isReturned}
                aria-label={`Wristband ${wristband}${isReturned ? ', returned' : ', outstanding'}`}
              >
                {wristband}
              </button>
            );
          })}</div>
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
      {entry.returnedWristbands.length === entry.wristbands.length ? <p className="aquapark-returned-label">All wristbands returned</p> : null}
      <button type="button" className="aquapark-entry-close" onClick={() => onDelete(entry.id)}>
        Close Entry
      </button>
    </article>
  );
}

function getTransactionQuantity(transaction: Transaction): number {
  return typeof transaction.metadata?.quantity === 'number' ? transaction.metadata.quantity : 0;
}

function getTransactionWristbands(transaction: Transaction): number {
  return typeof transaction.metadata?.wristbandCount === 'number' ? transaction.metadata.wristbandCount : 0;
}

function getDailyReport(transactions: Transaction[]) {
  const forType = (type: TransactionType) => transactions.filter((transaction) => isActiveTransaction(transaction) && transaction.type === type);
  const beachSales = forType('beach_set');
  const bedSales = forType('bed');
  const sunbedSales = forType('sunbed');
  const reservationPayments = forType('beach_reservation');
  const aquaparkSales = forType('aquapark');
  const totalFor = (items: Transaction[]) => items.reduce((total, item) => total + item.amount, 0);
  const ticketBreakdown = (Object.keys(AQUAPARK_TICKETS) as AquaparkTicketType[]).map((ticketType) => {
    const items = aquaparkSales.filter((item) => item.metadata?.ticketType === ticketType);
    return { ticketType, wristbandCount: items.reduce((total, item) => total + getTransactionWristbands(item), 0), total: totalFor(items) };
  });
  const beachTotal = totalFor(beachSales);
  const bedTotal = totalFor(bedSales);
  const sunbedTotal = totalFor(sunbedSales);
  const reservationTotal = totalFor(reservationPayments);
  const aquaparkTotal = totalFor(aquaparkSales);
  const sunbedsSectionTotal = beachTotal + bedTotal + sunbedTotal + reservationTotal;
  return { beachSales, bedSales, sunbedSales, reservationPayments, aquaparkSales, beachTotal, bedTotal, sunbedTotal, reservationTotal, aquaparkTotal, sunbedsSectionTotal, total: sunbedsSectionTotal + aquaparkTotal, sunbedQuantity: sunbedSales.reduce((total, sale) => total + getTransactionQuantity(sale), 0), wristbandCount: aquaparkSales.reduce((total, sale) => total + getTransactionWristbands(sale), 0), ticketBreakdown };
}

function formatReportDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}

function ReportsPage({ transactions, reportArchive }: { transactions: Transaction[]; reportArchive: ArchivedDailyReport[] }) {
  const [selectedDate, setSelectedDate] = useState<string>('today');
  const selectedArchive = reportArchive.find((report) => report.date === selectedDate);
  const reportTransactions = selectedArchive?.transactions ?? transactions;
  const reportDate = selectedArchive?.date ?? getLocalDateKey();

  return (
    <div className="reports-page">
      <section className="report-archive" aria-labelledby="report-archive-heading">
        <div className="report-archive-heading">
          <div>
            <p className="eyebrow">Saved daily snapshots</p>
            <h2 id="report-archive-heading">Report Archive</h2>
          </div>
          <span>{reportArchive.length} saved</span>
        </div>
        <div className="report-date-list" aria-label="Choose report date">
          <button type="button" className={selectedDate === 'today' ? 'active' : ''} onClick={() => setSelectedDate('today')}>Today</button>
          {reportArchive.map((report) => (
            <button type="button" className={selectedDate === report.date ? 'active' : ''} onClick={() => setSelectedDate(report.date)} key={report.date}>
              {formatReportDate(report.date)}
            </button>
          ))}
        </div>
        {!reportArchive.length ? <p className="report-empty">Previous daily reports will appear here after Daily Reset.</p> : null}
      </section>
      <DailyReport transactions={reportTransactions} date={reportDate} archived={Boolean(selectedArchive)} />
    </div>
  );
}

function DailyReport({ transactions, date, archived = false }: { transactions: Transaction[]; date: string; archived?: boolean }) {
  const report = useMemo(() => getDailyReport(transactions), [transactions]);

  return (
    <section className="daily-report-page" aria-labelledby="daily-report-heading">
      <header className="report-hero">
        <p className="eyebrow">{archived ? 'Archived daily snapshot' : 'Sales recorded in Beach Set Manager'}</p>
        <h2 id="daily-report-heading">{archived ? 'Archived Report' : 'Daily Report'}</h2>
        <p>{formatReportDate(date)}</p>
        <div className="report-total">
          <span>Total</span>
          <strong>{formatEuro(report.total)}</strong>
        </div>
        <div className="report-summary-grid">
          <span>Sunbeds<strong>{formatEuro(report.sunbedsSectionTotal)}</strong><small>{report.beachSales.length + report.bedSales.length + report.sunbedSales.length + report.reservationPayments.length} records</small></span>
          <span>Aquapark<strong>{formatEuro(report.aquaparkTotal)}</strong><small>{report.wristbandCount} wristbands</small></span>
        </div>
      </header>

      <section className="report-group report-group-sunbeds" aria-labelledby="sunbeds-group-heading">
        <div className="report-group-heading">
          <div><p className="eyebrow">Beach operation</p><h3 id="sunbeds-group-heading">Sunbeds</h3></div>
          <strong>{formatEuro(report.sunbedsSectionTotal)}</strong>
        </div>
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
              <p key={sale.id}><span>{sale.resourceLabel}</span><strong>{formatEuro(sale.amount)}</strong></p>
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
            {report.reservationPayments.map((payment) => (
              <p key={payment.id}>
                <span>{payment.resourceLabel}<small>{payment.description}</small></span>
                <strong>{formatEuro(payment.amount)}</strong>
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
              <p key={sale.id}><span>{sale.resourceLabel}</span><strong>{formatEuro(sale.amount)}</strong></p>
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
              <p key={sale.id}><span>{sale.resourceLabel}</span><strong>{formatEuro(sale.amount)}</strong></p>
            ))}
          </div>
        ) : <p className="report-empty">No current-day non-numbered Sunbed sales recorded.</p>}
      </section>
      </section>

      <section className="report-group report-group-aquapark" aria-labelledby="aquapark-group-heading">
        <div className="report-group-heading">
          <div><p className="eyebrow">Wristbands and tickets</p><h3 id="aquapark-group-heading">Aquapark</h3></div>
          <strong>{formatEuro(report.aquaparkTotal)}</strong>
        </div>
      <section className="report-section" aria-labelledby="aquapark-report-heading">
        <div className="report-section-heading">
          <div>
            <p className="eyebrow">Tracker entries created today</p>
            <h3 id="aquapark-report-heading">Aquapark ({report.wristbandCount} wristbands)</h3>
          </div>
          <strong>{formatEuro(report.aquaparkTotal)}</strong>
        </div>
        {report.aquaparkSales.length ? (
          <div className="report-list report-transaction-list">
            {report.aquaparkSales.map((sale) => (
              <p key={sale.id}>
                <span>{sale.resourceLabel}<small>{sale.description} · {getTransactionWristbands(sale)} wristbands</small></span>
                <strong>{formatEuro(sale.amount)}</strong>
              </p>
            ))}
          </div>
        ) : <p className="report-empty">No Aquapark sales were recorded.</p>}
        <p className="report-breakdown-label">Ticket totals</p>
        <div className="report-list">
          {report.ticketBreakdown.map((ticket) => (
            <p key={ticket.ticketType}>
              <span>
                {AQUAPARK_TICKETS[ticket.ticketType].label}
                <small>
                  {ticket.wristbandCount} wristbands
                </small>
              </span>
              <strong>{formatEuro(ticket.total)}</strong>
            </p>
          ))}
        </div>
      </section>
      </section>
    </section>
  );
}

function TransactionsPage({ transactions, onDelete }: { transactions: Transaction[]; onDelete: (transactionId: string) => void }) {
  const sorted = [...transactions].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  const labels: Record<TransactionType, string> = { beach_set: 'Beach Set', bed: 'Bed', sunbed: 'Non-numbered Sunbeds', beach_reservation: 'Beach Reservation', aquapark: 'Aquapark' };
  const activeCount = sorted.filter(isActiveTransaction).length;
  const deletedCount = sorted.length - activeCount;
  return <section className="transactions-page" aria-labelledby="transactions-heading">
    <header className="report-hero"><p className="eyebrow">Current-day recorded sales</p><h2 id="transactions-heading">Transactions</h2><p>{activeCount} active{deletedCount ? ` / ${deletedCount} deleted` : ''}, newest first</p></header>
    <div className="transactions-list">{sorted.length ? sorted.map((transaction) => <article className={`transaction-card${isActiveTransaction(transaction) ? '' : ' transaction-card-deleted'}`} key={transaction.id}>
      <div><p className="eyebrow">{formatTime(transaction.createdAt)} · {labels[transaction.type]}</p><strong>{transaction.resourceLabel || labels[transaction.type]}</strong>{transaction.description ? <small>{transaction.description}</small> : null}</div>
      {!isActiveTransaction(transaction) && transaction.deletedAt ? <p className="transaction-deleted-at"><span className="transaction-deleted-badge">Deleted</span> {formatAuditTimestamp(transaction.deletedAt)}</p> : null}
      <strong className="transaction-amount">{formatEuro(transaction.amount)}</strong>
      {isActiveTransaction(transaction) ? <button type="button" className="transaction-delete" onClick={() => onDelete(transaction.id)}>Delete Transaction</button> : null}
    </article>) : <p className="report-empty">No transactions recorded today.</p>}</div>
  </section>;
}

function TopNavigation({
  activeTab,
  onSelectTab,
}: {
  activeTab: TabId;
  onSelectTab: (tabId: TabId) => void;
}) {
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'beaches', label: 'Beaches' },
    { id: 'sunbeds', label: 'Sunbeds' },
    { id: 'aquapark', label: 'Aquapark' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <nav className="top-navigation" aria-label="Main app sections">
      {tabs.map((tab) => (
        <button
          type="button"
          className={`top-navigation-button tab-${tab.id}${activeTab === tab.id ? ' active' : ''}`}
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

function BeachShortcuts({ onSelect }: { onSelect: (section: BeachShortcut) => void }) {
  return <nav className="beach-shortcuts" aria-label="Beach sections">
    <button type="button" onClick={() => onSelect('beach1')}>Beach 1</button>
    <button type="button" onClick={() => onSelect('beach2')}>Beach 2</button>
    <button type="button" onClick={() => onSelect('beds')}>Beds</button>
  </nav>;
}

function SettingsPage({ view, backupMessage, importInputRef, savedSurnames, onDailyReset, onExport, onImport, onImportFile, onResetAppData, onDeleteSurname, onShowTransactions, onShowReport, onBackToSettings, transactions, reportArchive, onDeleteTransaction, authenticatedUser, authActionError, signOutPending, onSignOut }: {
  view: SettingsView;
  backupMessage: string | null;
  importInputRef: MutableRefObject<HTMLInputElement | null>;
  savedSurnames: ReservationSurname[];
  onDailyReset: () => void;
  onExport: () => void;
  onImport: () => void;
  onImportFile: (file: File | undefined) => void;
  onResetAppData: () => void;
  onDeleteSurname: (surname: string) => void;
  onShowTransactions: () => void;
  onShowReport: () => void;
  onBackToSettings: () => void;
  transactions: Transaction[];
  reportArchive: ArchivedDailyReport[];
  onDeleteTransaction: (transactionId: string) => void;
  authenticatedUser: AuthenticatedUser;
  authActionError: string | null;
  signOutPending: boolean;
  onSignOut: () => Promise<void>;
}) {
  if (view === 'transactions') {
    return <section className="settings-subpage"><button type="button" className="settings-back" onClick={onBackToSettings}>Back to Settings</button><TransactionsPage transactions={transactions} onDelete={onDeleteTransaction} /></section>;
  }
  if (view === 'report') {
    return <section className="settings-subpage"><button type="button" className="settings-back" onClick={onBackToSettings}>Back to Settings</button><ReportsPage transactions={transactions} reportArchive={reportArchive} /></section>;
  }
  return <section className="settings-page" aria-labelledby="settings-heading">
    <header className="report-hero"><p className="eyebrow">Shared Petalon controls</p><h2 id="settings-heading">Settings</h2></header>
    <section className="settings-section"><h3>Records</h3><div className="settings-menu-actions"><button type="button" className="tool-button" onClick={onShowTransactions}>Transactions</button><button type="button" className="tool-button" onClick={onShowReport}>Reports</button></div></section>
    <section className="settings-section"><h3>Daily Reset</h3><p>Start a fresh shared business day and clear current-day sales.</p><button type="button" className="reset-button" onClick={onDailyReset}>Daily Reset</button></section>
    <section className="settings-section"><h3>Backups</h3><p>Export the current shared Petalon state, or explicitly replace it by importing a compatible backup.</p><div className="tool-buttons"><button type="button" className="tool-button" onClick={onExport}>Export Backup</button><button type="button" className="tool-button" onClick={onImport}>Import Backup</button></div><input ref={importInputRef} className="file-input" type="file" accept="application/json,.json" onChange={(event) => onImportFile(event.target.files?.[0])} />{backupMessage ? <p className="backup-message">{backupMessage}</p> : null}</section>
    <section className="settings-section"><h3>Shared Tools</h3><button type="button" className="danger-link" onClick={onResetAppData}>Reset shared app data</button><SavedSurnamesManager savedSurnames={savedSurnames} onDeleteSurname={onDeleteSurname} /></section>
    <section className="settings-section settings-account"><h3>Account</h3><p>Signed in as <strong>{authenticatedUser.email || 'Authenticated user'}</strong></p><button type="button" className="sign-out-button" disabled={signOutPending} onClick={() => void onSignOut()}>{signOutPending ? 'Signing out…' : 'Sign out'}</button>{authActionError ? <p className="auth-error settings-auth-error" role="alert">{authActionError}</p> : null}</section>
    <section className="settings-about" aria-label="About"><span>About</span><strong>Built for Camp Petalon</strong></section>
  </section>;
}

function SetDetails({
  beachSet,
  beachReservations,
  revenue,
}: {
  beachSet: BeachSet;
  beachReservations: BeachReservation[];
  revenue: number;
}) {
  if (beachSet.status === 'paid') {
    return (
      <span className="card-detail">
        <strong>Paid</strong>
        <small>{beachSet.price ? formatEuro(beachSet.price) : '2 beds + parasol'}</small>
        {revenue > 0 ? <small>Today: {formatEuro(revenue)}</small> : null}
      </span>
    );
  }

  if (beachSet.status === 'reserved') {
    const reservation = getLinkedBeachReservation(beachSet.beachReservationId, beachReservations);

    return (
      <span className="card-detail">
        <strong>Reserved</strong>
        <small>{reservation?.surname || beachSet.surname || 'Missing reservation'}</small>
        <small>{formatDays(reservation ? getReservationDaysLeft(reservation.startDate, reservation.endDate) : beachSet.reservedDays)}</small>
      </span>
    );
  }

  if (beachSet.status === 'left') {
    return (
      <span className="card-detail">
        <strong>Left</strong>
        <small>{revenue > 0 ? `Today: ${formatEuro(revenue)}` : 'Available to sell again'}</small>
      </span>
    );
  }

  return (
    <span className="card-detail">
      <strong>Free</strong>
      <small>{revenue > 0 ? `Today: ${formatEuro(revenue)}` : 'Available'}</small>
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
        <small>{formatDays(reservation ? getReservationDaysLeft(reservation.startDate, reservation.endDate) : bed.reservedDays)}</small>
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
                    <span>{formatDaysLeft(getReservationDaysLeft(reservation.startDate, reservation.endDate))}</span>
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
  const [fixedTotal, setFixedTotal] = useState(set.priceMode === 'fixed' ? set.price ?? 0 : 0);
  const [priceMode, setPriceMode] = useState<SetPriceMode>(set.priceMode ?? 'fixed');
  const [specialPrice, setSpecialPrice] = useState(set.priceMode === 'special' && set.price ? String(set.price) : '');
  const parsedSpecialPrice = parsePositiveMoney(specialPrice);
  const finalPrice = priceMode === 'special' ? parsedSpecialPrice : fixedTotal > 0 ? fixedTotal : null;

  function saveAndClose(status: SetStatus, details?: Partial<BeachSet>) {
    onSave(status, details);
    onClose();
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
          <button type="button" className="sheet-button left-action" onClick={() => saveAndClose('left')}>
            Mark Left
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
  onSave: (details: { quantity: number; totalAmount: number; description?: string }) => void;
}) {
  const [quantity, setQuantity] = useState(String(sale?.quantity ?? 1));
  const [totalAmount, setTotalAmount] = useState(sale ? String(sale.totalAmount) : '');
  const [description, setDescription] = useState(sale?.description ?? '');
  const parsedQuantity = Number(quantity);
  const parsedAmount = parsePositiveMoney(totalAmount);
  const canSave = Number.isInteger(parsedQuantity) && parsedQuantity > 0 && parsedAmount !== null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="action-sheet sunbed-sale-sheet" role="dialog" aria-modal="true" aria-labelledby="sunbed-sale-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Non-numbered Sunbeds</p>
            <h2 id="sunbed-sale-title">{sale ? 'Edit Sunbed Sale' : 'New Sunbed Sale'}</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose}>Close</button>
        </header>
        <div className="detail-panel sunbed-sale-form-body">
          <label>
            Quantity sold
            <input type="number" inputMode="numeric" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label>
            Total amount paid
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="e.g. 32" />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Optional description / notes" />
          </label>
        </div>
        <div className="sunbed-sale-actions">
          <button type="button" className="sheet-button sunbeds-primary-button" disabled={!canSave} onClick={() => {
            if (canSave && parsedAmount !== null) onSave({ quantity: parsedQuantity, totalAmount: parsedAmount, description: description.trim() || undefined });
          }}>
            Save Sunbed Sale
          </button>
          <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
        </div>
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

function App() {
  const auth = useAuthSession();
  const shared = useSharedAppData(
    auth.state.status === 'authenticated' ? auth.state.user.id : null,
    parseImportedAppData,
  );

  if (auth.state.status === 'initializing') {
    return (
      <AuthStatusPage
        title="Starting securely"
        message="Restoring your session…"
        loading
      />
    );
  }

  if (auth.state.status === 'unavailable') {
    return (
      <AuthStatusPage
        title="Authentication unavailable"
        message={auth.state.message}
      />
    );
  }

  if (auth.state.status === 'unauthenticated') {
    return (
      <LoginPage
        error={auth.actionError}
        submitting={auth.signingIn}
        onSignIn={auth.signIn}
      />
    );
  }

  if (shared.state.status === 'loading') {
    return (
      <AuthStatusPage
        title="Loading shared Petalon data"
        message="Checking your active Petalon access and loading the current operational state..."
        loading
      />
    );
  }

  if (shared.state.status === 'not-found') {
    return (
      <AuthStatusPage
        title="Shared Petalon data is not set up"
        message="No operational state is available for Petalon. Local browser data was not used."
        actionLabel="Retry shared data"
        onAction={() => void shared.reload()}
      />
    );
  }

  if (shared.state.status === 'conflict') {
    const currentRevision = shared.state.current?.revision;
    return (
      <AuthStatusPage
        title="Newer shared data exists"
        message={`Another user saved Petalon first${currentRevision === undefined ? '' : ` at revision ${currentRevision}`}. Reloading shared data will discard this device's unsaved conflicting changes.`}
        actionLabel="Reload shared data"
        onAction={() => void shared.reload()}
      />
    );
  }

  if (shared.state.status === 'unavailable') {
    return (
      <AuthStatusPage
        title="Shared Petalon data unavailable"
        message={shared.state.phase === 'save'
          ? `${shared.state.message} Changes on this device were not saved. Reloading will discard them.`
          : `${shared.state.message} Local browser data was not used.`}
        actionLabel="Reload shared data"
        onAction={() => void shared.reload()}
      />
    );
  }

  return (
    <OperationalApp
      key={shared.state.generation}
      initialSharedAppData={shared.state.data}
      sharedRevision={shared.state.revision}
      sharedSyncStatus={shared.state.syncStatus}
      onAppDataChange={shared.update}
      authenticatedUser={auth.state.user}
      authActionError={auth.actionError}
      signOutPending={auth.signingOut}
      onSignOut={auth.signOut}
    />
  );
}

export default App;
