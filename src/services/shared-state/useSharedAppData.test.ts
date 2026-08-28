import { describe, expect, it, vi } from 'vitest';
import type { SharedStateControllerState } from './sharedStateController';
import {
  scopeSharedStateToSelection,
  admitSharedUpdateForBinding,
  type UserScopedSharedState,
} from './useSharedAppData';

type TestData = { owner: string };

function ready(owner: string, revision: number): SharedStateControllerState<TestData> {
  return {
    status: 'ready',
    data: { owner },
    revision,
    generation: 1,
    syncStatus: 'saved',
    deviceSafety: 'safe',
    refreshStatus: 'idle',
    updatedAt: '2026-08-26T00:00:00.000Z',
  };
}

describe('authenticated-user shared-state scoping', () => {
  it('rejects a visible mutation explicitly when no controller binding exists', () => {
    expect(admitSharedUpdateForBinding(
      'user-a',
      'location-a',
      null,
      { owner: 'visible-local-change' },
      1,
    )).toEqual({
      status: 'rejected',
      reason: 'controller_unavailable',
    });
  });

  it('rejects an account-mismatched controller instead of silently ignoring it', () => {
    const update = vi.fn();
    expect(admitSharedUpdateForBinding(
      'user-b',
      'location-a',
      { userId: 'user-a', locationId: 'location-a', controller: { update } },
      { owner: 'user-b' },
      2,
    )).toEqual({
      status: 'rejected',
      reason: 'identity_mismatch',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a location-mismatched controller instead of crossing locations', () => {
    const update = vi.fn();
    expect(admitSharedUpdateForBinding(
      'user-a',
      'koversada',
      { userId: 'user-a', locationId: 'petalon', controller: { update } },
      { owner: 'visible-koversada-change' },
      3,
    )).toEqual({
      status: 'rejected',
      reason: 'location_mismatch',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('exposes ready shared data only to the user identity that loaded it', () => {
    const userAState: UserScopedSharedState<TestData> = {
      userId: 'user-a',
      locationId: 'petalon',
      state: ready('user-a', 7),
    };

    expect(scopeSharedStateToSelection('user-a', 'petalon', userAState)).toEqual(
      ready('user-a', 7),
    );
  });

  it('synchronously stops exposing the previous user state on sign-out', () => {
    const userAState: UserScopedSharedState<TestData> = {
      userId: 'user-a',
      locationId: 'petalon',
      state: ready('user-a', 7),
    };

    expect(scopeSharedStateToSelection(null, null, userAState)).toEqual({
      status: 'loading',
    });
  });

  it('keeps User B loading until User B own repository load succeeds', () => {
    const userAState: UserScopedSharedState<TestData> = {
      userId: 'user-a',
      locationId: 'petalon',
      state: ready('user-a', 7),
    };
    const userBLoading: UserScopedSharedState<TestData> = {
      userId: 'user-b',
      locationId: 'petalon',
      state: { status: 'loading' },
    };
    const userBReady: UserScopedSharedState<TestData> = {
      userId: 'user-b',
      locationId: 'petalon',
      state: ready('user-b', 8),
    };

    expect(scopeSharedStateToSelection('user-b', 'petalon', userAState)).toEqual({
      status: 'loading',
    });
    expect(scopeSharedStateToSelection('user-b', 'petalon', userBLoading)).toEqual({
      status: 'loading',
    });
    expect(scopeSharedStateToSelection('user-b', 'petalon', userBReady)).toEqual(
      ready('user-b', 8),
    );
  });

  it('exposes User B unavailable result without revealing User A cached data', () => {
    const userAState: UserScopedSharedState<TestData> = {
      userId: 'user-a',
      locationId: 'petalon',
      state: ready('user-a', 7),
    };
    const userBUnavailable: UserScopedSharedState<TestData> = {
      userId: 'user-b',
      locationId: 'petalon',
      state: {
        status: 'unavailable',
        phase: 'load',
        message: 'Shared location state is not accessible for the current user.',
        retryable: false,
      },
    };

    expect(scopeSharedStateToSelection('user-b', 'petalon', userAState)).toEqual({
      status: 'loading',
    });
    expect(
      scopeSharedStateToSelection('user-b', 'petalon', userBUnavailable),
    ).toEqual(userBUnavailable.state);
  });

  it('stops exposing Petalon immediately when Koversada is selected', () => {
    const petalonState: UserScopedSharedState<TestData> = {
      userId: 'mark',
      locationId: 'petalon',
      state: ready('petalon', 20),
    };

    expect(scopeSharedStateToSelection('mark', 'koversada', petalonState)).toEqual({
      status: 'loading',
    });
  });
});
