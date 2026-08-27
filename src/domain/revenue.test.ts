import { describe, expect, it } from 'vitest';
import type { Transaction } from './appData';
import {
  calculateDailyRevenue,
  calculateRevenueDifference,
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
});
