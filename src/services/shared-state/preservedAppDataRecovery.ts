import type { AppData, Transaction } from '../../domain/appData';

export type PreservedPaidSetPayment = {
  transactionId: string;
  setId: number;
  amount: number;
  createdAt: string;
};

export type PreservedAppDataRecoveryFile = {
  app: 'Beach Set Manager';
  kind: 'preserved-unsaved-app-data';
  version: 1;
  exportedAt: string;
  locationId: string;
  serverRevision: number | null;
  preservedData: AppData;
};

function isActive(transaction: Transaction): boolean {
  return transaction.status !== 'deleted';
}

export function findPreservedPaidSetPayments(
  preserved: AppData,
  current: AppData | null,
): PreservedPaidSetPayment[] {
  const currentTransactionIds = new Set(
    current?.transactions.map((transaction) => transaction.id) ?? [],
  );

  return preserved.transactions
    .filter((transaction) => (
      transaction.type === 'beach_set' &&
      isActive(transaction) &&
      !currentTransactionIds.has(transaction.id)
    ))
    .reduce<PreservedPaidSetPayment[]>((payments, transaction) => {
      const setId = Number(transaction.resourceId);
      const set = preserved.sets[setId];
      if (
        !Number.isSafeInteger(setId) ||
        !set ||
        set.status !== 'paid' ||
        set.dailySaleId !== transaction.id ||
        !Number.isFinite(transaction.amount) ||
        transaction.amount <= 0
      ) {
        return payments;
      }

      return [...payments, {
        transactionId: transaction.id,
        setId,
        amount: transaction.amount,
        createdAt: transaction.createdAt,
      }];
    }, [])
    .sort((first, second) => first.setId - second.setId);
}

export function createPreservedAppDataRecoveryFile(
  preservedData: AppData,
  locationId: string,
  serverRevision: number | null,
  exportedAt = new Date().toISOString(),
): PreservedAppDataRecoveryFile {
  return {
    app: 'Beach Set Manager',
    kind: 'preserved-unsaved-app-data',
    version: 1,
    exportedAt,
    locationId,
    serverRevision,
    preservedData,
  };
}
