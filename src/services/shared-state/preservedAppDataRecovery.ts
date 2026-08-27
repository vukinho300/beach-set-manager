import type { AppData, Transaction } from '../../domain/appData';

export type PreservedPaidSetPayment = {
  transactionId: string;
  setId: number;
  amount: number;
  createdAt: string;
};

export type PreservedFinancialActivity = {
  transactionId: string;
  type: Transaction['type'];
  label: string;
  amount: number;
  createdAt: string;
};

export type PreservedAppDataRecoveryFile = {
  app: 'Beach Set Manager';
  kind: 'preserved-unsaved-app-data';
  version: 2;
  exportedAt: string;
  userId: string;
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

function getActivityLabel(transaction: Transaction): string {
  if (transaction.resourceLabel?.trim()) {
    return transaction.resourceLabel.trim();
  }

  const fallbackLabels: Record<Transaction['type'], string> = {
    beach_set: 'Beach set',
    bed: 'Bed',
    sunbed: 'Non-numbered sunbeds',
    beach_reservation: 'Beach reservation',
    aquapark: 'Aquapark entry',
  };

  return fallbackLabels[transaction.type];
}

export function findPreservedFinancialActivity(
  preserved: AppData,
  current: AppData | null,
): PreservedFinancialActivity[] {
  const currentTransactionIds = new Set(
    current?.transactions.map((transaction) => transaction.id) ?? [],
  );

  return preserved.transactions
    .filter((transaction) => (
      isActive(transaction) &&
      !currentTransactionIds.has(transaction.id) &&
      Number.isFinite(transaction.amount) &&
      transaction.amount > 0
    ))
    .map((transaction) => ({
      transactionId: transaction.id,
      type: transaction.type,
      label: getActivityLabel(transaction),
      amount: transaction.amount,
      createdAt: transaction.createdAt,
    }))
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export function createPreservedAppDataRecoveryFile(
  preservedData: AppData,
  userId: string,
  locationId: string,
  serverRevision: number | null,
  exportedAt = new Date().toISOString(),
): PreservedAppDataRecoveryFile {
  return {
    app: 'Beach Set Manager',
    kind: 'preserved-unsaved-app-data',
    version: 2,
    exportedAt,
    userId,
    locationId,
    serverRevision,
    preservedData,
  };
}
