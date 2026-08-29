import type { AppData, Transaction } from '../../domain/appData';
import { isValidAppDataReconciliationSnapshot } from './appDataKnownConflictReconciliation';
import { areSharedStatesEqual } from './sharedStateController';

type ResourceValue =
  | { present: false }
  | { present: true; value: unknown };

const TOP_LEVEL_KEYS = new Set([
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

function canonicalTransaction(transaction: Transaction): Transaction {
  return {
    ...transaction,
    status: transaction.status ?? 'active',
    ...((transaction.status ?? 'active') === 'deleted'
      ? {}
      : { deletedAt: undefined }),
  };
}

function withoutUpdatedAt<T extends { updatedAt?: string }>(value: T): Omit<T, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...rest } = value;
  return rest;
}

function present(value: unknown): ResourceValue {
  return { present: true, value };
}

function projectResources(state: AppData): Map<string, ResourceValue> {
  const resources = new Map<string, ResourceValue>();
  for (const [id, set] of Object.entries(state.sets)) {
    resources.set(`set:${id}`, present(withoutUpdatedAt(set)));
  }
  for (const [id, bed] of Object.entries(state.extraBeds)) {
    resources.set(`bed:${id}`, present(withoutUpdatedAt(bed)));
  }
  for (const sale of state.sunbedSales) {
    resources.set(`sunbed-sale:${sale.id}`, present(sale));
  }
  for (const entry of state.aquaparkEntries) {
    resources.set(`aquapark-entry:${entry.id}`, present(entry));
  }
  for (const transaction of state.transactions) {
    resources.set(`transaction:${transaction.id}`, present(canonicalTransaction(transaction)));
  }
  for (const key of [
    'beachReservations',
    'savedSurnames',
    'reportArchive',
    'lastAutomaticResetDate',
  ] as const) {
    resources.set(`unsupported:${key}`, {
      present: Object.prototype.hasOwnProperty.call(state, key),
      ...(
        Object.prototype.hasOwnProperty.call(state, key)
          ? { value: state[key] }
          : {}
      ),
    } as ResourceValue);
  }
  for (const [key, value] of Object.entries(state)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      resources.set(`unknown-top-level:${key}`, present(value));
    }
  }
  return resources;
}

function resourceValue(resources: Map<string, ResourceValue>, key: string): ResourceValue {
  return resources.get(key) ?? { present: false };
}

/**
 * Proves that a bounded revision chain contains no resource value other than
 * its base or final value. This rejects hidden add/remove, reset/restore and
 * touch/restore histories while allowing disjoint resources to become final
 * over several accepted revisions. Production obtains the same boolean proof
 * from the private immutable history without exposing its snapshots.
 */
export function isMonotonicAppDataRevisionChain(states: readonly unknown[]): boolean {
  if (
    states.length < 2
    || states.some((state) => !isValidAppDataReconciliationSnapshot(state))
  ) {
    return false;
  }

  const projections = (states as readonly AppData[]).map(projectResources);
  const base = projections[0];
  const current = projections[projections.length - 1];
  const resourceKeys = new Set(projections.flatMap((projection) => [...projection.keys()]));

  return projections.every((projection) => [...resourceKeys].every((key) => {
    const candidate = resourceValue(projection, key);
    return areSharedStatesEqual(candidate, resourceValue(base, key))
      || areSharedStatesEqual(candidate, resourceValue(current, key));
  }));
}
