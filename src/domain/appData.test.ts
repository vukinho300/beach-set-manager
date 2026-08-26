import { describe, expect, it, vi } from 'vitest';
import { createDefaultAppData, type AppData } from './appData';
import type { SharedLocationStateRepository } from '../services/shared-state/repository';
import { SharedStateController } from '../services/shared-state/sharedStateController';

const LOCATION_ID = '00000000-0000-4000-8000-000000000001';

describe('operational AppData boundary', () => {
  it('creates a clean Petalon state with all sets and beds free and no fake activity', () => {
    const state = createDefaultAppData(new Date(2026, 7, 26, 12));

    expect(Object.values(state.sets)).toHaveLength(56);
    expect(Object.values(state.sets).every((set) => set.status === 'free')).toBe(true);
    expect(Object.values(state.extraBeds)).toHaveLength(4);
    expect(Object.values(state.extraBeds).every((bed) => bed.status === 'free')).toBe(true);
    expect(state).toMatchObject({
      beachReservations: [],
      savedSurnames: [],
      sunbedSales: [],
      aquaparkEntries: [],
      transactions: [],
      reportArchive: [],
      lastAutomaticResetDate: '2026-08-26',
    });
  });

  it('saves a full imported AppData snapshot through the normal revision-safe path', async () => {
    const initial = createDefaultAppData(new Date(2026, 7, 26, 12));
    const imported: AppData = { ...initial, savedSurnames: ['Imported Backup'] };
    const save = vi.fn(async (
      locationId: string,
      expectedRevision: number,
      nextState: AppData,
    ) => ({
      status: 'accepted' as const,
      value: {
        locationId,
        state: nextState,
        revision: expectedRevision + 1,
        updatedAt: '2026-08-26T12:00:00.000Z',
      },
    }));
    const repository: SharedLocationStateRepository<AppData> = {
      load: async () => ({
        status: 'found',
        value: {
          locationId: LOCATION_ID,
          state: initial,
          revision: 5,
          updatedAt: '2026-08-26T11:00:00.000Z',
        },
      }),
      save,
      subscribe: () => () => undefined,
    };
    const controller = new SharedStateController(
      repository,
      LOCATION_ID,
      (value) => value as AppData,
    );
    await controller.reload();

    controller.update(imported);
    await Promise.resolve();
    await Promise.resolve();

    expect(save).toHaveBeenCalledWith(LOCATION_ID, 5, imported);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 6,
      data: { savedSurnames: ['Imported Backup'] },
    });
  });
});
