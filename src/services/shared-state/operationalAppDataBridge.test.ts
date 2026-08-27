import { describe, expect, it } from 'vitest';
import { areSharedStatesEqual } from './sharedStateController';
import {
  consumeOperationalSnapshot,
  createOperationalAppDataBridge,
  isIncomingAuthoritativeSnapshot,
  stageAuthoritativeSnapshot,
} from './operationalAppDataBridge';
import {
  shouldArmAdmissionWatchdog,
  shouldLockOperationalMutations,
} from './operationalWriteSafety';

describe('OperationalApp authoritative snapshot bridge', () => {
  it('applies a newer authoritative snapshot without echoing it as a local save', () => {
    const initial = { marker: 'server-4', value: 4 };
    const remote = { marker: 'server-5', value: 5 };
    const bridge = createOperationalAppDataBridge(initial);

    expect(stageAuthoritativeSnapshot(bridge, remote, areSharedStatesEqual)).toBe(true);
    expect(consumeOperationalSnapshot(bridge, remote, areSharedStatesEqual)).toBe(false);
    expect(consumeOperationalSnapshot(
      bridge,
      { marker: 'local', value: 6 },
      areSharedStatesEqual,
    )).toBe(true);
  });

  it('does not stage an equal server snapshot or suppress the next real local change', () => {
    const initial = { marker: 'same', value: 4 };
    const bridge = createOperationalAppDataBridge(initial);

    expect(stageAuthoritativeSnapshot(
      bridge,
      { value: 4, marker: 'same' },
      areSharedStatesEqual,
    )).toBe(false);
    expect(consumeOperationalSnapshot(
      bridge,
      { marker: 'local', value: 5 },
      areSharedStatesEqual,
    )).toBe(true);
  });

  it('forwards a worker mutation interleaved with an authoritative refresh', () => {
    const initial = {
      sets: { 40: { status: 'free' } },
      aquaparkEntries: [],
    };
    const remote = {
      sets: { 40: { status: 'left' } },
      aquaparkEntries: [],
    };
    const remoteWithWorkerEntry = {
      ...remote,
      aquaparkEntries: [{ id: 'worker-entry', wristbands: [91] }],
    };
    const bridge = createOperationalAppDataBridge(initial);

    expect(stageAuthoritativeSnapshot(bridge, remote, areSharedStatesEqual)).toBe(true);
    expect(consumeOperationalSnapshot(
      bridge,
      remoteWithWorkerEntry,
      areSharedStatesEqual,
    )).toBe(true);
    expect(bridge.pendingAuthoritativeSnapshot).toBeNull();
    expect(consumeOperationalSnapshot(
      bridge,
      remote,
      areSharedStatesEqual,
    )).toBe(true);
    expect(consumeOperationalSnapshot(
      bridge,
      { ...remoteWithWorkerEntry, aquaparkEntries: [
        ...remoteWithWorkerEntry.aquaparkEntries,
        { id: 'worker-entry-2', wristbands: [92] },
      ] },
      areSharedStatesEqual,
    )).toBe(true);
  });

  it('distinguishes a realtime authoritative transition from an unadmitted local mutation', () => {
    const oldServerState = { marker: 'server-262', value: 262 };
    const newServerState = { marker: 'server-263', value: 263 };
    const localMutation = { marker: 'local-payment', value: 264 };
    const bridge = createOperationalAppDataBridge(oldServerState);

    const receivingAuthoritativeSnapshot = isIncomingAuthoritativeSnapshot(
      bridge,
      oldServerState,
      newServerState,
      areSharedStatesEqual,
    );
    expect(receivingAuthoritativeSnapshot).toBe(true);
    const visibleStateTrackedByController = areSharedStatesEqual(
      oldServerState,
      newServerState,
    ) || receivingAuthoritativeSnapshot;
    expect(shouldLockOperationalMutations(
      visibleStateTrackedByController,
      'safe',
      false,
    )).toBe(false);
    expect(shouldArmAdmissionWatchdog(
      visibleStateTrackedByController,
      'saved',
      'safe',
    )).toBe(false);
    expect(stageAuthoritativeSnapshot(
      bridge,
      newServerState,
      areSharedStatesEqual,
    )).toBe(true);
    expect(consumeOperationalSnapshot(
      bridge,
      newServerState,
      areSharedStatesEqual,
    )).toBe(false);

    expect(isIncomingAuthoritativeSnapshot(
      createOperationalAppDataBridge(oldServerState),
      localMutation,
      oldServerState,
      areSharedStatesEqual,
    )).toBe(false);
  });

  it('does not excuse a concurrent local mutation when an authoritative update arrives', () => {
    const oldServerState = { marker: 'server-262', value: 262 };
    const newServerState = { marker: 'server-263', value: 263 };
    const concurrentLocalMutation = { marker: 'local-payment', value: 264 };
    const bridge = createOperationalAppDataBridge(oldServerState);

    const receivingAuthoritativeSnapshot = isIncomingAuthoritativeSnapshot(
      bridge,
      concurrentLocalMutation,
      newServerState,
      areSharedStatesEqual,
    );
    expect(receivingAuthoritativeSnapshot).toBe(false);
    const visibleStateTrackedByController = areSharedStatesEqual(
      concurrentLocalMutation,
      newServerState,
    ) || receivingAuthoritativeSnapshot;
    expect(shouldLockOperationalMutations(
      visibleStateTrackedByController,
      'safe',
      false,
    )).toBe(true);
    expect(shouldArmAdmissionWatchdog(
      visibleStateTrackedByController,
      'saved',
      'safe',
    )).toBe(true);
  });
});
