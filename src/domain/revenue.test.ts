import { describe, expect, it } from 'vitest';
import type { Transaction } from './appData';
import { createCleanLocationAppData } from './location';
import {
  archiveTransactionsForDate,
  calculateDailyRevenue,
  calculateRevenueDifference,
  getTransactionsForBusinessDate,
  getZagrebBusinessDate,
} from './revenue';

function transaction(
  id: string,
  type: Transaction['type'],
  amount: number,
): Transaction {
  return {
    id,
    type,
    amount,
    createdAt: '2026-08-27T10:00:00.000Z',
    status: 'active',
    metadata: type === 'aquapark'
      ? { wristbandCount: 2, ticketType: '30min' }
      : undefined,
  };
}

describe('shared app revenue semantics', () => {
  it('produces the deterministic €120 Petalon + €48 Koversada result without double counting', () => {
    const petalon = calculateDailyRevenue([
      transaction('set', 'beach_set', 70),
      transaction('sunbed', 'sunbed', 30),
      transaction('aquapark', 'aquapark', 20),
    ], 'PETALON_FULL');
    const koversada = calculateDailyRevenue([
      transaction('aquapark-k', 'aquapark', 48),
    ], 'KOVERSADA_AQUAPARK');

    expect(petalon.total).toBe(120);
    expect(koversada.total).toBe(48);
    expect(petalon.total + koversada.total).toBe(168);
  });

  it('excludes Petalon domains from the Koversada profile even if malformed state contains them', () => {
    const report = calculateDailyRevenue([
      transaction('set', 'beach_set', 100),
      transaction('bed', 'bed', 20),
      transaction('sunbed', 'sunbed', 10),
      transaction('aquapark', 'aquapark', 48),
    ], 'KOVERSADA_AQUAPARK');

    expect(report.total).toBe(48);
    expect(report.beachSales).toEqual([]);
    expect(report.bedSales).toEqual([]);
    expect(report.sunbedSales).toEqual([]);
  });

  it('implements the exact 10% and zero-revenue rules', () => {
    expect(calculateRevenueDifference(900, 1000)).toEqual({
      status: 'percentage', percentage: 10, alert: false,
    });
    expect(calculateRevenueDifference(890, 1000)).toEqual({
      status: 'percentage', percentage: 11, alert: true,
    });
    expect(calculateRevenueDifference(0, 0)).toEqual({
      status: 'percentage', percentage: 0, alert: false,
    });
    expect(calculateRevenueDifference(1, 0)).toEqual({
      status: 'real-zero-mismatch', alert: true,
    });
    expect(calculateRevenueDifference(100, null)).toEqual({ status: 'missing' });
  });

  it('uses Europe/Zagreb rather than UTC midnight', () => {
    expect(getZagrebBusinessDate(new Date('2026-08-27T22:30:00.000Z')))
      .toBe('2026-08-28');
  });

  it('uses current transactions for today when no same-day archive exists', () => {
    const appData = {
      ...createCleanLocationAppData('PETALON_FULL', '2026-08-28'),
      transactions: [transaction('current-120', 'beach_set', 120)],
    };

    const transactions = getTransactionsForBusinessDate(
      appData,
      '2026-08-28',
      '2026-08-28',
    );
    expect(calculateDailyRevenue(transactions ?? [], 'PETALON_FULL').total).toBe(120);
  });

  it('combines same-day archived and current segments', () => {
    const appData = {
      ...createCleanLocationAppData('PETALON_FULL', '2026-08-28'),
      transactions: [transaction('current-48', 'aquapark', 48)],
      reportArchive: [{
        date: '2026-08-28',
        archivedAt: '2026-08-28T18:00:00.000Z',
        transactions: [transaction('archived-120', 'beach_set', 120)],
      }],
    };

    const transactions = getTransactionsForBusinessDate(
      appData,
      '2026-08-28',
      '2026-08-28',
    );
    expect(calculateDailyRevenue(transactions ?? [], 'PETALON_FULL').total).toBe(168);
  });

  it('deduplicates an ID found in both today archive and current state', () => {
    const duplicate = transaction('stable-120', 'beach_set', 120);
    const appData = {
      ...createCleanLocationAppData('PETALON_FULL', '2026-08-28'),
      transactions: [{ ...duplicate }],
      reportArchive: [{
        date: '2026-08-28',
        archivedAt: '2026-08-28T18:00:00.000Z',
        transactions: [duplicate],
      }],
    };

    const transactions = getTransactionsForBusinessDate(
      appData,
      '2026-08-28',
      '2026-08-28',
    );
    expect(transactions).toHaveLength(1);
    expect(calculateDailyRevenue(transactions ?? [], 'PETALON_FULL').total).toBe(120);
  });

  it('merges repeated same-day Daily Reset segments into one archive', () => {
    const first = archiveTransactionsForDate(
      [],
      '2026-08-28',
      [transaction('segment-a', 'beach_set', 120)],
      '2026-08-28T18:00:00.000Z',
    );
    const second = archiveTransactionsForDate(
      first,
      '2026-08-28',
      [transaction('segment-b', 'aquapark', 48)],
      '2026-08-28T20:00:00.000Z',
    );

    expect(second).toHaveLength(1);
    expect(second[0].transactions.map((item) => item.id)).toEqual([
      'segment-a',
      'segment-b',
    ]);
    expect(calculateDailyRevenue(second[0].transactions, 'PETALON_FULL').total)
      .toBe(168);
  });

  it('uses archive-only revenue for a historical date', () => {
    const appData = {
      ...createCleanLocationAppData('PETALON_FULL', '2026-08-28'),
      transactions: [transaction('today', 'beach_set', 999)],
      reportArchive: [{
        date: '2026-08-27',
        archivedAt: '2026-08-28T00:00:00.000Z',
        transactions: [transaction('historical', 'beach_set', 120)],
      }],
    };

    const transactions = getTransactionsForBusinessDate(
      appData,
      '2026-08-27',
      '2026-08-28',
    );
    expect(calculateDailyRevenue(transactions ?? [], 'PETALON_FULL').total).toBe(120);
  });

  it('combines Koversada same-day segments but counts only Aquapark', () => {
    const appData = {
      ...createCleanLocationAppData('KOVERSADA_AQUAPARK', '2026-08-28'),
      transactions: [
        transaction('current-aqua', 'aquapark', 48),
        transaction('malformed-current-set', 'beach_set', 500),
      ],
      reportArchive: [{
        date: '2026-08-28',
        archivedAt: '2026-08-28T18:00:00.000Z',
        transactions: [transaction('archived-aqua', 'aquapark', 120)],
      }],
    };

    const transactions = getTransactionsForBusinessDate(
      appData,
      '2026-08-28',
      '2026-08-28',
    );
    expect(calculateDailyRevenue(transactions ?? [], 'KOVERSADA_AQUAPARK').total)
      .toBe(168);
  });

  it('keeps deletion state sticky while deduplicating same-day transactions', () => {
    const archived = transaction('deleted-later', 'beach_set', 120);
    const deletedCurrent = { ...archived, status: 'deleted' as const };
    const appData = {
      ...createCleanLocationAppData('PETALON_FULL', '2026-08-28'),
      transactions: [deletedCurrent],
      reportArchive: [{
        date: '2026-08-28',
        archivedAt: '2026-08-28T18:00:00.000Z',
        transactions: [archived],
      }],
    };

    const transactions = getTransactionsForBusinessDate(
      appData,
      '2026-08-28',
      '2026-08-28',
    );
    expect(transactions).toEqual([deletedCurrent]);
    expect(calculateDailyRevenue(transactions ?? [], 'PETALON_FULL').total).toBe(0);

    const mergedArchive = archiveTransactionsForDate(
      [{
        date: '2026-08-28',
        archivedAt: '2026-08-28T18:00:00.000Z',
        transactions: [deletedCurrent],
      }],
      '2026-08-28',
      [archived],
      '2026-08-28T20:00:00.000Z',
    );
    expect(mergedArchive[0].transactions).toEqual([deletedCurrent]);
  });
});
