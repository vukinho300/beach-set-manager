import {
  AQUAPARK_TICKETS,
  type AppData,
  type AquaparkTicketType,
  type ArchivedDailyReport,
  type Transaction,
  type TransactionType,
} from './appData';
import type { LocationInterfaceProfile } from './location';

export type DailyRevenueReport = {
  beachSales: Transaction[];
  bedSales: Transaction[];
  sunbedSales: Transaction[];
  reservationPayments: Transaction[];
  aquaparkSales: Transaction[];
  beachTotal: number;
  bedTotal: number;
  sunbedTotal: number;
  reservationTotal: number;
  aquaparkTotal: number;
  sunbedsSectionTotal: number;
  total: number;
  sunbedQuantity: number;
  wristbandCount: number;
  ticketBreakdown: Array<{
    ticketType: AquaparkTicketType;
    wristbandCount: number;
    total: number;
  }>;
};

export type RevenueDifference =
  | { status: 'missing' }
  | { status: 'percentage'; percentage: number; alert: boolean }
  | { status: 'real-zero-mismatch'; alert: true };

function isBusinessDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function mergeTransactionsById(
  ...sources: readonly Transaction[][]
): Transaction[] {
  const merged: Transaction[] = [];
  const indexById = new Map<string, number>();

  for (const source of sources) {
    for (const transaction of source) {
      const existingIndex = indexById.get(transaction.id);
      if (existingIndex === undefined) {
        indexById.set(transaction.id, merged.length);
        merged.push(transaction);
        continue;
      }

      const existing = merged[existingIndex];
      merged[existingIndex] = existing.status === 'deleted'
        && transaction.status !== 'deleted'
        ? existing
        : transaction;
    }
  }

  return merged;
}

export function archiveTransactionsForDate(
  archive: ArchivedDailyReport[],
  date: string | undefined,
  transactions: Transaction[],
  archivedAt = new Date().toISOString(),
): ArchivedDailyReport[] {
  if (!date || !isBusinessDateKey(date)) {
    return archive;
  }

  const existing = archive.find((report) => report.date === date);
  const report: ArchivedDailyReport = {
    date,
    archivedAt,
    transactions: mergeTransactionsById(
      existing?.transactions ?? [],
      transactions,
    ).map((transaction) => ({ ...transaction })),
  };

  return [report, ...archive.filter((candidate) => candidate.date !== date)]
    .sort((first, second) => second.date.localeCompare(first.date));
}

function isActiveTransaction(transaction: Transaction): boolean {
  return transaction.status !== 'deleted';
}

function transactionQuantity(transaction: Transaction): number {
  return typeof transaction.metadata?.quantity === 'number'
    ? transaction.metadata.quantity
    : 0;
}

function transactionWristbands(transaction: Transaction): number {
  return typeof transaction.metadata?.wristbandCount === 'number'
    ? transaction.metadata.wristbandCount
    : 0;
}

export function calculateDailyRevenue(
  transactions: Transaction[],
  profile: LocationInterfaceProfile = 'PETALON_FULL',
): DailyRevenueReport {
  const visibleTransactions = profile === 'KOVERSADA_AQUAPARK'
    ? transactions.filter((transaction) => transaction.type === 'aquapark')
    : transactions;
  const forType = (type: TransactionType) => visibleTransactions.filter(
    (transaction) => isActiveTransaction(transaction) && transaction.type === type,
  );
  const beachSales = forType('beach_set');
  const bedSales = forType('bed');
  const sunbedSales = forType('sunbed');
  const reservationPayments = forType('beach_reservation');
  const aquaparkSales = forType('aquapark');
  const totalFor = (items: Transaction[]) => items.reduce(
    (total, item) => total + item.amount,
    0,
  );
  const ticketBreakdown = (Object.keys(AQUAPARK_TICKETS) as AquaparkTicketType[])
    .map((ticketType) => {
      const items = aquaparkSales.filter(
        (item) => item.metadata?.ticketType === ticketType,
      );
      return {
        ticketType,
        wristbandCount: items.reduce(
          (total, item) => total + transactionWristbands(item),
          0,
        ),
        total: totalFor(items),
      };
    });
  const beachTotal = totalFor(beachSales);
  const bedTotal = totalFor(bedSales);
  const sunbedTotal = totalFor(sunbedSales);
  const reservationTotal = totalFor(reservationPayments);
  const aquaparkTotal = totalFor(aquaparkSales);
  const sunbedsSectionTotal = beachTotal + bedTotal + sunbedTotal + reservationTotal;
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
    sunbedsSectionTotal,
    total: sunbedsSectionTotal + aquaparkTotal,
    sunbedQuantity: sunbedSales.reduce(
      (total, sale) => total + transactionQuantity(sale),
      0,
    ),
    wristbandCount: aquaparkSales.reduce(
      (total, sale) => total + transactionWristbands(sale),
      0,
    ),
    ticketBreakdown,
  };
}
export function getZagrebBusinessDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getTransactionsForBusinessDate(
  appData: AppData,
  businessDate: string,
  today = getZagrebBusinessDate(),
): Transaction[] | null {
  const archived = appData.reportArchive.find(
    (report) => report.date === businessDate,
  );
  if (businessDate === today) {
    return mergeTransactionsById(
      archived?.transactions ?? [],
      appData.transactions,
    );
  }
  return archived?.transactions ?? null;
}

export function calculateRevenueDifference(
  appRevenue: number,
  realRevenue: number | null,
): RevenueDifference {
  if (realRevenue === null) {
    return { status: 'missing' };
  }
  if (realRevenue === 0) {
    return appRevenue === 0
      ? { status: 'percentage', percentage: 0, alert: false }
      : { status: 'real-zero-mismatch', alert: true };
  }

  const percentage = Math.abs(appRevenue - realRevenue) / realRevenue * 100;
  return {
    status: 'percentage',
    percentage,
    alert: percentage > 10,
  };
}
