import { describe, expect, it } from 'vitest';
import { areSharedStatesEqual } from './sharedStateController';
import {
  consumeOperationalSnapshot,
  createOperationalAppDataBridge,
  stageAuthoritativeSnapshot,
} from './operationalAppDataBridge';

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
});
