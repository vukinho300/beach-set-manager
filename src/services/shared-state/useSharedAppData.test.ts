import { describe, expect, it } from 'vitest';
import type { SharedStateControllerState } from './sharedStateController';
import {
  scopeSharedStateToAuthenticatedUser,
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
    updatedAt: '2026-08-26T00:00:00.000Z',
  };
}

describe('authenticated-user shared-state scoping', () => {
  it('exposes ready shared data only to the user identity that loaded it', () => {
    const userAState: UserScopedSharedState<TestData> = {
      userId: 'user-a',
      state: ready('user-a', 7),
    };

    expect(scopeSharedStateToAuthenticatedUser('user-a', userAState)).toEqual(
      ready('user-a', 7),
    );
  });

  it('synchronously stops exposing the previous user state on sign-out', () => {
    const userAState: UserScopedSharedState<TestData> = {
      userId: 'user-a',
      state: ready('user-a', 7),
    };

    expect(scopeSharedStateToAuthenticatedUser(null, userAState)).toEqual({
      status: 'loading',
    });
  });

  it('keeps User B loading until User B own repository load succeeds', () => {
    const userAState: UserScopedSharedState<TestData> = {
      userId: 'user-a',
      state: ready('user-a', 7),
    };
    const userBLoading: UserScopedSharedState<TestData> = {
      userId: 'user-b',
      state: { status: 'loading' },
    };
    const userBReady: UserScopedSharedState<TestData> = {
      userId: 'user-b',
      state: ready('user-b', 8),
    };

    expect(scopeSharedStateToAuthenticatedUser('user-b', userAState)).toEqual({
      status: 'loading',
    });
    expect(scopeSharedStateToAuthenticatedUser('user-b', userBLoading)).toEqual({
      status: 'loading',
    });
    expect(scopeSharedStateToAuthenticatedUser('user-b', userBReady)).toEqual(
      ready('user-b', 8),
    );
  });

  it('exposes User B unavailable result without revealing User A cached data', () => {
    const userAState: UserScopedSharedState<TestData> = {
      userId: 'user-a',
      state: ready('user-a', 7),
    };
    const userBUnavailable: UserScopedSharedState<TestData> = {
      userId: 'user-b',
      state: {
        status: 'unavailable',
        phase: 'load',
        message: 'Shared location state is not accessible for the current user.',
        retryable: false,
      },
    };

    expect(scopeSharedStateToAuthenticatedUser('user-b', userAState)).toEqual({
      status: 'loading',
    });
    expect(
      scopeSharedStateToAuthenticatedUser('user-b', userBUnavailable),
    ).toEqual(userBUnavailable.state);
  });
});
