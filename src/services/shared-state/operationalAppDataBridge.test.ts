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
    expect(consumeOperationalSnapshot(bridge, remote)).toBe(false);
    expect(consumeOperationalSnapshot(bridge, { marker: 'local', value: 6 })).toBe(true);
  });

  it('does not stage an equal server snapshot or suppress the next real local change', () => {
    const initial = { marker: 'same', value: 4 };
    const bridge = createOperationalAppDataBridge(initial);

    expect(stageAuthoritativeSnapshot(
      bridge,
      { value: 4, marker: 'same' },
      areSharedStatesEqual,
    )).toBe(false);
    expect(consumeOperationalSnapshot(bridge, { marker: 'local', value: 5 })).toBe(true);
  });
});
