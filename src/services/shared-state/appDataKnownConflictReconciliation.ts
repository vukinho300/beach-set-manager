import {
  AQUAPARK_TICKETS,
  EXTRA_BED_IDS,
  TOTAL_SETS,
  getBeachForSet,
  type AppData,
  type AquaparkEntry,
  type BeachReservation,
  type BeachSet,
  type BedId,
  type ExtraBed,
  type NonNumberedSunbedSale,
  type Transaction,
} from '../../domain/appData';
import type { KnownRejectedConflictReconciliation } from './sharedStateController';
import { areSharedStatesEqual } from './sharedStateController';

type ReconciliationInput = {
  baseState: AppData;
  desiredState: AppData;
  currentState: AppData;
  rawCurrentState: unknown;
};

type BundleKind =
  | 'set-status'
  | 'set-payment'
  | 'bed-status'
  | 'bed-payment'
  | 'sunbed-sale-add'
  | 'aquapark-entry-add'
  | 'aquapark-return-update'
  | 'aquapark-close';

type ChangeBundle = {
  kind: BundleKind;
  operationKey: string;
  signature: unknown;
  writes: ReadonlySet<string>;
  reads: ReadonlySet<string>;
};

type ClassifiedDelta = {
  bundles: ChangeBundle[];
  setPatches: Map<number, BeachSet>;
  bedPatches: Map<BedId, ExtraBed>;
  addedSunbedSales: NonNumberedSunbedSale[];
  addedAquaparkEntries: AquaparkEntry[];
  aquaparkPatches: Map<string, AquaparkEntry>;
  addedTransactions: Transaction[];
};

type ClassificationResult =
  | { status: 'supported'; delta: ClassifiedDelta }
  | { status: 'unsupported'; reason: string };

// R2.1 is intentionally a closed business-operation allowlist. This module must
// reject every AppData difference it cannot consume; it is not a general merge.

const TOP_LEVEL_KEYS = new Set<keyof AppData>([
  'sets',
  'extraBeds',
  'beachReservations',
  'savedSurnames',
  'sunbedSales',
  'aquaparkEntries',
  'transactions',
  'reportArchive',
  'lastAutomaticResetDate',
]);

const SET_KEYS = new Set<keyof BeachSet>([
  'id',
  'beach',
  'status',
  'beachReservationId',
  'surname',
  'reservedDays',
  'price',
  'priceMode',
  'dailySaleId',
  'updatedAt',
]);

const BED_KEYS = new Set<keyof ExtraBed>([
  'id',
  'label',
  'status',
  'beachReservationId',
  'surname',
  'reservedDays',
  'price',
  'priceMode',
  'dailySaleId',
  'updatedAt',
]);

const TRANSACTION_KEYS = new Set<keyof Transaction>([
  'id',
  'type',
  'amount',
  'createdAt',
  'status',
  'deletedAt',
  'resourceId',
  'resourceLabel',
  'description',
  'metadata',
]);

const RESERVATION_KEYS = new Set<keyof BeachReservation>([
  'id',
  'surname',
  'startDate',
  'endDate',
  'totalAmountPaid',
  'paymentRecordedAt',
  'reservedDays',
  'notes',
  'createdAt',
  'updatedAt',
]);

function unsupported(reason: string): ClassificationResult {
  return { status: 'unsupported', reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function hasUniqueNonEmptyIds(values: unknown[]): boolean {
  const ids = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || !isNonEmptyString(value.id) || ids.has(value.id)) {
      return false;
    }
    ids.add(value.id);
  }
  return true;
}

function hasUniqueNumbers(values: unknown[]): boolean {
  return values.every((value) => Number.isSafeInteger(value) && (value as number) > 0)
    && new Set(values).size === values.length;
}

function isValidSet(value: unknown, expectedId: number): value is BeachSet {
  if (!isRecord(value) || !hasOnlyKeys(value, SET_KEYS)) {
    return false;
  }
  return value.id === expectedId
    && value.beach === getBeachForSet(expectedId)
    && ['free', 'paid', 'reserved', 'left'].includes(String(value.status))
    && isOptionalString(value.beachReservationId)
    && isOptionalString(value.surname)
    && (value.reservedDays === undefined || isFinitePositive(value.reservedDays))
    && (value.price === undefined || isFinitePositive(value.price))
    && (value.priceMode === undefined || value.priceMode === 'fixed' || value.priceMode === 'special')
    && isOptionalString(value.dailySaleId)
    && isOptionalString(value.updatedAt);
}

function isValidReservation(value: unknown): value is BeachReservation {
  if (!isRecord(value) || !hasOnlyKeys(value, RESERVATION_KEYS)) {
    return false;
  }
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.surname)
    && isNonEmptyString(value.startDate)
    && isNonEmptyString(value.endDate)
    && (value.totalAmountPaid === undefined || isFinitePositive(value.totalAmountPaid))
    && isOptionalString(value.paymentRecordedAt)
    && (value.reservedDays === undefined || isFinitePositive(value.reservedDays))
    && isOptionalString(value.notes)
    && isNonEmptyString(value.createdAt)
    && isOptionalString(value.updatedAt);
}

function isValidBed(value: unknown, expectedId: BedId): value is ExtraBed {
  if (!isRecord(value) || !hasOnlyKeys(value, BED_KEYS)) {
    return false;
  }
  return value.id === expectedId
    && value.label === `Bed ${expectedId}`
    && ['free', 'paid', 'reserved'].includes(String(value.status))
    && isOptionalString(value.beachReservationId)
    && isOptionalString(value.surname)
    && (value.reservedDays === undefined || isFinitePositive(value.reservedDays))
    && (value.price === undefined || isFinitePositive(value.price))
    && (value.priceMode === undefined || value.priceMode === 'fixed' || value.priceMode === 'special')
    && isOptionalString(value.dailySaleId)
    && isOptionalString(value.updatedAt);
}

function isValidTransaction(value: unknown): value is Transaction {
  if (!isRecord(value) || !hasOnlyKeys(value, TRANSACTION_KEYS)) {
    return false;
  }
  return isNonEmptyString(value.id)
    && ['beach_set', 'bed', 'sunbed', 'beach_reservation', 'aquapark'].includes(String(value.type))
    && isFinitePositive(value.amount)
    && isNonEmptyString(value.createdAt)
    && (value.status === undefined || value.status === 'active' || value.status === 'deleted')
    && (value.status === 'deleted'
      ? isNonEmptyString(value.deletedAt)
      : value.deletedAt === undefined)
    && isOptionalString(value.resourceId)
    && isOptionalString(value.resourceLabel)
    && isOptionalString(value.description)
    && (value.metadata === undefined || isRecord(value.metadata));
}

function isValidSunbedSale(value: unknown): value is NonNumberedSunbedSale {
  if (!isRecord(value)) {
    return false;
  }
  const keys = new Set(['id', 'quantity', 'totalAmount', 'description', 'createdAt']);
  return hasOnlyKeys(value, keys)
    && isNonEmptyString(value.id)
    && Number.isSafeInteger(value.quantity)
    && (value.quantity as number) > 0
    && isFinitePositive(value.totalAmount)
    && isOptionalString(value.description)
    && isNonEmptyString(value.createdAt);
}

function isValidAquaparkEntry(value: unknown): value is AquaparkEntry {
  if (!isRecord(value)) {
    return false;
  }
  const keys = new Set([
    'id', 'wristbands', 'ticketType', 'defaultUnitPrice', 'unitPrice', 'totalPrice',
    'priceMode', 'status', 'isLegacyPrice', 'startAt', 'endAt', 'extraMinutes',
    'validUntil', 'customDays', 'dailyUnitPrice', 'description', 'createdAt',
    'closedAt', 'returnedWristbands',
  ]);
  if (
    !hasOnlyKeys(value, keys)
    || !isNonEmptyString(value.id)
    || !Array.isArray(value.wristbands)
    || value.wristbands.length === 0
    || !hasUniqueNumbers(value.wristbands)
    || !Array.isArray(value.returnedWristbands)
    || !hasUniqueNumbers(value.returnedWristbands)
    || !(value.returnedWristbands as number[]).every((wristband) =>
      (value.wristbands as number[]).includes(wristband))
  ) {
    return false;
  }
  return typeof value.ticketType === 'string'
    && Object.prototype.hasOwnProperty.call(AQUAPARK_TICKETS, value.ticketType)
    && isFinitePositive(value.defaultUnitPrice)
    && isFinitePositive(value.unitPrice)
    && isFinitePositive(value.totalPrice)
    && (value.priceMode === 'default' || value.priceMode === 'special')
    && (value.status === 'active' || value.status === 'closed')
    && (value.isLegacyPrice === undefined || typeof value.isLegacyPrice === 'boolean')
    && isNonEmptyString(value.startAt)
    && Number.isSafeInteger(value.extraMinutes)
    && (value.extraMinutes as number) >= 0
    && isNonEmptyString(value.createdAt)
    && (value.customDays === undefined
      || (typeof value.customDays === 'number'
        && Number.isSafeInteger(value.customDays)
        && value.customDays > 0))
    && (value.dailyUnitPrice === undefined || isFinitePositive(value.dailyUnitPrice))
    && isOptionalString(value.endAt)
    && isOptionalString(value.validUntil)
    && isOptionalString(value.description)
    && isOptionalString(value.closedAt);
}

function isValidSnapshot(value: unknown): value is AppData {
  if (!isRecord(value) || !hasOnlyKeys(value, TOP_LEVEL_KEYS)) {
    return false;
  }
  const sets = value.sets;
  const extraBeds = value.extraBeds;
  if (
    !isRecord(sets)
    || Object.keys(sets).length !== TOTAL_SETS
    || !Array.from({ length: TOTAL_SETS }, (_, index) => index + 1)
      .every((id) => isValidSet(sets[String(id)], id))
    || !isRecord(extraBeds)
    || Object.keys(extraBeds).length !== EXTRA_BED_IDS.length
    || !EXTRA_BED_IDS.every((id) => isValidBed(extraBeds[String(id)], id))
  ) {
    return false;
  }
  if (
    !Array.isArray(value.beachReservations)
    || !hasUniqueNonEmptyIds(value.beachReservations)
    || !value.beachReservations.every(isValidReservation)
    || !Array.isArray(value.savedSurnames)
    || !value.savedSurnames.every((surname) => isNonEmptyString(surname))
    || new Set(value.savedSurnames).size !== value.savedSurnames.length
    || !Array.isArray(value.sunbedSales)
    || !hasUniqueNonEmptyIds(value.sunbedSales)
    || !value.sunbedSales.every(isValidSunbedSale)
    || !Array.isArray(value.aquaparkEntries)
    || !hasUniqueNonEmptyIds(value.aquaparkEntries)
    || !value.aquaparkEntries.every(isValidAquaparkEntry)
    || !Array.isArray(value.transactions)
    || !hasUniqueNonEmptyIds(value.transactions)
    || !value.transactions.every(isValidTransaction)
    || !Array.isArray(value.reportArchive)
    || new Set(value.reportArchive.map((report) => isRecord(report) ? report.date : undefined)).size
      !== value.reportArchive.length
    || (value.lastAutomaticResetDate !== undefined && typeof value.lastAutomaticResetDate !== 'string')
  ) {
    return false;
  }
  return value.reportArchive.every((report) =>
    isRecord(report)
    && hasOnlyKeys(report, new Set(['date', 'archivedAt', 'transactions']))
    && isNonEmptyString(report.date)
    && isNonEmptyString(report.archivedAt)
    && Array.isArray(report.transactions)
    && hasUniqueNonEmptyIds(report.transactions)
    && report.transactions.every(isValidTransaction));
}

export function isValidAppDataReconciliationSnapshot(value: unknown): value is AppData {
  return isValidSnapshot(value);
}

function canonicalTransaction(transaction: Transaction): Transaction {
  return {
    ...transaction,
    status: transaction.status ?? 'active',
    ...(transaction.status === 'deleted' ? {} : { deletedAt: undefined }),
  };
}

function transactionsEqual(first: Transaction, second: Transaction): boolean {
  return areSharedStatesEqual(canonicalTransaction(first), canonicalTransaction(second));
}

function indexById<T extends { id: string }>(values: T[]): Map<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

function hasAppendedIds(baseIds: string[], targetIds: string[]): boolean {
  return targetIds.length >= baseIds.length
    && baseIds.every((id, index) => targetIds[index] === id);
}

function hasPrependedIds(baseIds: string[], targetIds: string[]): boolean {
  const offset = targetIds.length - baseIds.length;
  return offset >= 0 && baseIds.every((id, index) => targetIds[index + offset] === id);
}

function noPaymentDetails(value: BeachSet | ExtraBed): boolean {
  return value.price === undefined
    && value.priceMode === undefined
    && value.dailySaleId === undefined;
}

function noReservationDetails(value: BeachSet | ExtraBed): boolean {
  return value.beachReservationId === undefined
    && value.surname === undefined
    && value.reservedDays === undefined;
}

function validNonPaymentSetTarget(value: BeachSet): boolean {
  if (!isNonEmptyString(value.updatedAt)) {
    return false;
  }
  if (value.status === 'free' || value.status === 'left') {
    return noPaymentDetails(value) && noReservationDetails(value);
  }
  return value.status === 'reserved'
    && noPaymentDetails(value)
    && isNonEmptyString(value.beachReservationId)
    && isNonEmptyString(value.surname)
    && isFinitePositive(value.reservedDays);
}

function validNonPaymentBedTarget(value: ExtraBed): boolean {
  if (!isNonEmptyString(value.updatedAt)) {
    return false;
  }
  if (value.status === 'free') {
    return noPaymentDetails(value) && noReservationDetails(value);
  }
  return value.status === 'reserved'
    && noPaymentDetails(value)
    && isNonEmptyString(value.beachReservationId)
    && isNonEmptyString(value.surname)
    && isFinitePositive(value.reservedDays);
}

function validPaymentTarget(value: BeachSet | ExtraBed): boolean {
  return value.status === 'paid'
    && isFinitePositive(value.price)
    && (value.priceMode === 'fixed' || value.priceMode === 'special')
    && isNonEmptyString(value.dailySaleId)
    && isNonEmptyString(value.updatedAt)
    && noReservationDetails(value);
}

function activeTransaction(transaction: Transaction): boolean {
  return (transaction.status ?? 'active') === 'active' && transaction.deletedAt === undefined;
}

function exactMetadata(value: unknown, expected: Record<string, unknown>): boolean {
  return isRecord(value) && areSharedStatesEqual(value, expected);
}

function linkedSetTransaction(transaction: Transaction, set: BeachSet): boolean {
  return activeTransaction(transaction)
    && transaction.id === set.dailySaleId
    && transaction.type === 'beach_set'
    && transaction.amount === set.price
    && transaction.resourceId === String(set.id)
    && transaction.resourceLabel === `Set ${set.id}`
    && transaction.description === undefined
    && transaction.metadata === undefined;
}

function linkedBedTransaction(transaction: Transaction, bed: ExtraBed): boolean {
  return activeTransaction(transaction)
    && transaction.id === bed.dailySaleId
    && transaction.type === 'bed'
    && transaction.amount === bed.price
    && transaction.resourceId === String(bed.id)
    && transaction.resourceLabel === `Bed ${bed.id}`
    && transaction.description === undefined
    && transaction.metadata === undefined;
}

function linkedSunbedTransaction(
  transaction: Transaction,
  sale: NonNumberedSunbedSale,
): boolean {
  return activeTransaction(transaction)
    && transaction.type === 'sunbed'
    && transaction.amount === sale.totalAmount
    && transaction.createdAt === sale.createdAt
    && transaction.resourceId === sale.id
    && transaction.resourceLabel === `${sale.quantity} sunbeds`
    && transaction.description === undefined
    && exactMetadata(transaction.metadata, { quantity: sale.quantity });
}

function linkedAquaparkTransaction(
  transaction: Transaction,
  entry: AquaparkEntry,
): boolean {
  return activeTransaction(transaction)
    && transaction.type === 'aquapark'
    && transaction.amount === entry.totalPrice
    && transaction.createdAt === entry.createdAt
    && transaction.resourceId === entry.id
    && transaction.resourceLabel === `Wristbands ${entry.wristbands.join(', ')}`
    && transaction.description === AQUAPARK_TICKETS[entry.ticketType].label
    && exactMetadata(transaction.metadata, {
      ticketType: entry.ticketType,
      wristbandCount: entry.wristbands.length,
      unitPrice: entry.unitPrice,
      customDays: entry.customDays,
    });
}

function bundle(
  kind: BundleKind,
  operationKey: string,
  signature: unknown,
  writes: string[],
  reads: string[] = [],
): ChangeBundle {
  return {
    kind,
    operationKey,
    signature,
    writes: new Set(writes),
    reads: new Set(reads),
  };
}

function classifyDelta(base: AppData, target: AppData): ClassificationResult {
  if (
    !areSharedStatesEqual(base.beachReservations, target.beachReservations)
    || !areSharedStatesEqual(base.savedSurnames, target.savedSurnames)
    || !areSharedStatesEqual(base.reportArchive, target.reportArchive)
    || !areSharedStatesEqual(base.lastAutomaticResetDate, target.lastAutomaticResetDate)
  ) {
    return unsupported('unsupported_top_level_domain');
  }

  const baseTransactions = indexById(base.transactions);
  const targetTransactions = indexById(target.transactions);
  if (!hasAppendedIds(
    base.transactions.map((transaction) => transaction.id),
    target.transactions.map((transaction) => transaction.id),
  )) {
    return unsupported('transaction_remove_update_or_reorder');
  }
  for (const transaction of base.transactions) {
    const next = targetTransactions.get(transaction.id);
    if (!next || !transactionsEqual(transaction, next)) {
      return unsupported('transaction_update_or_delete');
    }
  }
  const addedTransactions = target.transactions.filter(
    (transaction) => !baseTransactions.has(transaction.id),
  );
  const addedTransactionById = indexById(addedTransactions);
  const consumedTransactionIds = new Set<string>();
  const bundles: ChangeBundle[] = [];
  const setPatches = new Map<number, BeachSet>();
  const bedPatches = new Map<BedId, ExtraBed>();

  function consumeTransaction(transactionId: string): Transaction | null {
    const transaction = addedTransactionById.get(transactionId);
    if (!transaction || consumedTransactionIds.has(transactionId)) {
      return null;
    }
    consumedTransactionIds.add(transactionId);
    return transaction;
  }

  for (let setId = 1; setId <= TOTAL_SETS; setId += 1) {
    const before = base.sets[setId];
    const after = target.sets[setId];
    if (areSharedStatesEqual(before, after)) {
      continue;
    }
    setPatches.set(setId, after);
    if (after.status === 'paid') {
      if (!validPaymentTarget(after)) {
        return unsupported('partial_set_payment');
      }
      const transaction = consumeTransaction(after.dailySaleId as string);
      if (!transaction || !linkedSetTransaction(transaction, after)) {
        return unsupported('partial_set_payment');
      }
      bundles.push(bundle(
        'set-payment',
        `set:${setId}`,
        { set: after, transaction: canonicalTransaction(transaction) },
        [`set:${setId}`, `transaction:${transaction.id}`, `financial-resource:beach_set:${setId}`],
      ));
      continue;
    }
    if (!validNonPaymentSetTarget(after)) {
      return unsupported('unsupported_set_change');
    }
    if (
      after.status === 'reserved'
      && !target.beachReservations.some((reservation) => reservation.id === after.beachReservationId)
    ) {
      return unsupported('missing_set_reservation_dependency');
    }
    bundles.push(bundle(
      'set-status',
      `set:${setId}`,
      after,
      [`set:${setId}`],
      after.beachReservationId ? [`reservation:${after.beachReservationId}`] : [],
    ));
  }

  for (const bedId of EXTRA_BED_IDS) {
    const before = base.extraBeds[bedId];
    const after = target.extraBeds[bedId];
    if (areSharedStatesEqual(before, after)) {
      continue;
    }
    bedPatches.set(bedId, after);
    if (after.status === 'paid') {
      if (!validPaymentTarget(after)) {
        return unsupported('partial_bed_payment');
      }
      const transaction = consumeTransaction(after.dailySaleId as string);
      if (!transaction || !linkedBedTransaction(transaction, after)) {
        return unsupported('partial_bed_payment');
      }
      bundles.push(bundle(
        'bed-payment',
        `bed:${bedId}`,
        { bed: after, transaction: canonicalTransaction(transaction) },
        [`bed:${bedId}`, `transaction:${transaction.id}`, `financial-resource:bed:${bedId}`],
      ));
      continue;
    }
    if (!validNonPaymentBedTarget(after)) {
      return unsupported('unsupported_bed_change');
    }
    if (
      after.status === 'reserved'
      && !target.beachReservations.some((reservation) => reservation.id === after.beachReservationId)
    ) {
      return unsupported('missing_bed_reservation_dependency');
    }
    bundles.push(bundle(
      'bed-status',
      `bed:${bedId}`,
      after,
      [`bed:${bedId}`],
      after.beachReservationId ? [`reservation:${after.beachReservationId}`] : [],
    ));
  }

  const baseSunbeds = indexById(base.sunbedSales);
  const targetSunbeds = indexById(target.sunbedSales);
  if (!hasPrependedIds(
    base.sunbedSales.map((sale) => sale.id),
    target.sunbedSales.map((sale) => sale.id),
  )) {
    return unsupported('sunbed_edit_delete_or_reorder');
  }
  for (const sale of base.sunbedSales) {
    if (!areSharedStatesEqual(sale, targetSunbeds.get(sale.id))) {
      return unsupported('sunbed_edit_or_delete');
    }
  }
  const addedSunbedSales = target.sunbedSales.filter((sale) => !baseSunbeds.has(sale.id));
  for (const sale of addedSunbedSales) {
    const transaction = addedTransactions.find(
      (candidate) => candidate.type === 'sunbed' && candidate.resourceId === sale.id,
    );
    if (!transaction || consumedTransactionIds.has(transaction.id) || !linkedSunbedTransaction(transaction, sale)) {
      return unsupported('partial_sunbed_sale');
    }
    consumedTransactionIds.add(transaction.id);
    bundles.push(bundle(
      'sunbed-sale-add',
      `sunbed-sale:${sale.id}`,
      { sale, transaction: canonicalTransaction(transaction) },
      [`sunbed-sale:${sale.id}`, `transaction:${transaction.id}`, `financial-resource:sunbed:${sale.id}`],
    ));
  }

  const baseAquapark = indexById(base.aquaparkEntries);
  const targetAquapark = indexById(target.aquaparkEntries);
  if (!hasPrependedIds(
    base.aquaparkEntries.map((entry) => entry.id),
    target.aquaparkEntries.map((entry) => entry.id),
  )) {
    return unsupported('aquapark_remove_or_reorder');
  }
  const addedAquaparkEntries = target.aquaparkEntries.filter(
    (entry) => !baseAquapark.has(entry.id),
  );
  const aquaparkPatches = new Map<string, AquaparkEntry>();
  for (const entry of base.aquaparkEntries) {
    const next = targetAquapark.get(entry.id);
    if (!next) {
      return unsupported('aquapark_remove');
    }
    if (areSharedStatesEqual(entry, next)) {
      continue;
    }
    aquaparkPatches.set(entry.id, next);
    const withoutReturnedBefore = { ...entry, returnedWristbands: undefined };
    const withoutReturnedAfter = { ...next, returnedWristbands: undefined };
    const withoutCloseBefore = { ...entry, status: undefined, closedAt: undefined };
    const withoutCloseAfter = { ...next, status: undefined, closedAt: undefined };
    if (areSharedStatesEqual(withoutReturnedBefore, withoutReturnedAfter)) {
      const changedWristbands = new Set([
        ...entry.returnedWristbands.filter((wristband) => !next.returnedWristbands.includes(wristband)),
        ...next.returnedWristbands.filter((wristband) => !entry.returnedWristbands.includes(wristband)),
      ]);
      if (changedWristbands.size !== 1) {
        return unsupported('unsupported_aquapark_return_bundle');
      }
      bundles.push(bundle(
        'aquapark-return-update',
        `aquapark-entry:${entry.id}`,
        next,
        [
          `aquapark-entry:${entry.id}`,
          ...[...changedWristbands]
            .map((wristband) => `wristband:${wristband}`),
        ],
      ));
      continue;
    }
    if (
      areSharedStatesEqual(withoutCloseBefore, withoutCloseAfter)
      && entry.status === 'active'
      && next.status === 'closed'
      && isNonEmptyString(next.closedAt)
    ) {
      bundles.push(bundle(
        'aquapark-close',
        `aquapark-entry:${entry.id}`,
        next,
        [`aquapark-entry:${entry.id}`],
      ));
      continue;
    }
    return unsupported('unsupported_aquapark_update');
  }

  if (addedAquaparkEntries.length > 0 && aquaparkPatches.size > 0) {
    return unsupported('aquapark_add_reassigned_existing_entry');
  }
  for (const entry of addedAquaparkEntries) {
    if (entry.status !== 'active' || entry.returnedWristbands.length > 0) {
      return unsupported('unsupported_aquapark_add');
    }
    const overlapsActiveBaseEntry = base.aquaparkEntries.some((existing) =>
      existing.status === 'active'
      && existing.wristbands.some((wristband) =>
        entry.wristbands.includes(wristband)
        && !existing.returnedWristbands.includes(wristband)));
    if (overlapsActiveBaseEntry) {
      return unsupported('aquapark_add_reassigned_existing_entry');
    }
    const transaction = addedTransactions.find(
      (candidate) => candidate.type === 'aquapark' && candidate.resourceId === entry.id,
    );
    if (!transaction || consumedTransactionIds.has(transaction.id) || !linkedAquaparkTransaction(transaction, entry)) {
      return unsupported('partial_aquapark_entry');
    }
    consumedTransactionIds.add(transaction.id);
    bundles.push(bundle(
      'aquapark-entry-add',
      `aquapark-entry:${entry.id}`,
      { entry, transaction: canonicalTransaction(transaction) },
      [
        `aquapark-entry:${entry.id}`,
        `transaction:${transaction.id}`,
        `financial-resource:aquapark:${entry.id}`,
        ...entry.wristbands.map((wristband) => `wristband:${wristband}`),
      ],
    ));
  }

  if (consumedTransactionIds.size !== addedTransactions.length) {
    return unsupported('standalone_transaction_add');
  }

  for (let firstIndex = 0; firstIndex < bundles.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < bundles.length; secondIndex += 1) {
      if (setsIntersect(bundles[firstIndex].writes, bundles[secondIndex].writes)) {
        return unsupported('overlapping_local_bundles');
      }
    }
  }

  return {
    status: 'supported',
    delta: {
      bundles,
      setPatches,
      bedPatches,
      addedSunbedSales,
      addedAquaparkEntries,
      aquaparkPatches,
      addedTransactions,
    },
  };
}

function setsIntersect(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  for (const value of first) {
    if (second.has(value)) {
      return true;
    }
  }
  return false;
}

function bundlesConflict(first: ChangeBundle, second: ChangeBundle): boolean {
  return setsIntersect(first.writes, second.writes)
    || setsIntersect(first.writes, second.reads)
    || setsIntersect(first.reads, second.writes);
}

function bundlesIdentical(first: ChangeBundle, second: ChangeBundle): boolean {
  return first.kind === second.kind
    && first.operationKey === second.operationKey
    && areSharedStatesEqual(first.signature, second.signature);
}

function applyLocalDelta(
  current: AppData,
  local: ClassifiedDelta,
  identicalOperationKeys: ReadonlySet<string>,
): AppData {
  // The authoritative remote snapshot is always the source of the rebased state.
  // Only explicitly classified local patches and additions are applied to it.
  const sets = { ...current.sets };
  for (const [setId, value] of local.setPatches) {
    if (!identicalOperationKeys.has(`set:${setId}`)) {
      sets[setId] = value;
    }
  }
  const extraBeds = { ...current.extraBeds };
  for (const [bedId, value] of local.bedPatches) {
    if (!identicalOperationKeys.has(`bed:${bedId}`)) {
      extraBeds[bedId] = value;
    }
  }
  const addedSunbedSales = local.addedSunbedSales.filter(
    (sale) => !identicalOperationKeys.has(`sunbed-sale:${sale.id}`),
  );
  const addedAquaparkEntries = local.addedAquaparkEntries.filter(
    (entry) => !identicalOperationKeys.has(`aquapark-entry:${entry.id}`),
  );
  const aquaparkEntries = [
    ...addedAquaparkEntries,
    ...current.aquaparkEntries.map((entry) => {
      const patch = local.aquaparkPatches.get(entry.id);
      return patch && !identicalOperationKeys.has(`aquapark-entry:${entry.id}`)
        ? patch
        : entry;
    }),
  ];
  const remoteTransactionIds = new Set(current.transactions.map((transaction) => transaction.id));
  const transactions = [
    ...current.transactions,
    ...local.addedTransactions.filter((transaction) => !remoteTransactionIds.has(transaction.id)),
  ];
  return {
    ...current,
    sets,
    extraBeds,
    sunbedSales: [...addedSunbedSales, ...current.sunbedSales],
    aquaparkEntries,
    transactions,
  };
}

export function reconcileKnownRejectedAppDataConflict(
  input: ReconciliationInput,
): KnownRejectedConflictReconciliation<AppData> {
  if (
    !isValidSnapshot(input.baseState)
    || !isValidSnapshot(input.desiredState)
    || !isValidSnapshot(input.currentState)
    || !isValidSnapshot(input.rawCurrentState)
  ) {
    return { status: 'unsupported', reason: 'invalid_or_duplicate_identity' };
  }

  const localResult = classifyDelta(input.baseState, input.desiredState);
  const remoteResult = classifyDelta(input.baseState, input.currentState);
  if (localResult.status === 'unsupported') {
    return localResult;
  }
  if (remoteResult.status === 'unsupported') {
    return remoteResult;
  }

  const identicalOperationKeys = new Set<string>();
  for (const localBundle of localResult.delta.bundles) {
    for (const remoteBundle of remoteResult.delta.bundles) {
      if (!bundlesConflict(localBundle, remoteBundle)) {
        continue;
      }
      if (!bundlesIdentical(localBundle, remoteBundle)) {
        return { status: 'conflicting', reason: 'same_resource_changed_differently' };
      }
      identicalOperationKeys.add(localBundle.operationKey);
    }
  }

  const rebased = applyLocalDelta(
    input.currentState,
    localResult.delta,
    identicalOperationKeys,
  );
  if (!isValidSnapshot(rebased)) {
    return { status: 'unsupported', reason: 'rebased_state_invalid' };
  }
  const rebasedDelta = classifyDelta(input.currentState, rebased);
  if (rebasedDelta.status === 'unsupported') {
    return { status: 'unsupported', reason: 'rebased_delta_invalid' };
  }

  return areSharedStatesEqual(rebased, input.currentState)
    ? { status: 'already-present', state: input.currentState }
    : { status: 'rebased', state: rebased };
}
