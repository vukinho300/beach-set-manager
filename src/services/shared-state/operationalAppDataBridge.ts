export type OperationalAppDataBridge<T> = {
  current: T;
  pendingAuthoritativeSnapshot: T | null;
};

export function createOperationalAppDataBridge<T>(
  initial: T,
): OperationalAppDataBridge<T> {
  return { current: initial, pendingAuthoritativeSnapshot: null };
}

export function isIncomingAuthoritativeSnapshot<T>(
  bridge: OperationalAppDataBridge<T>,
  local: T,
  authoritative: T,
  equals: (first: T, second: T) => boolean,
): boolean {
  return equals(local, bridge.current)
    && !equals(authoritative, bridge.current);
}

export function stageAuthoritativeSnapshot<T>(
  bridge: OperationalAppDataBridge<T>,
  next: T,
  equals: (first: T, second: T) => boolean,
): boolean {
  if (equals(next, bridge.current)) {
    return false;
  }

  bridge.current = next;
  bridge.pendingAuthoritativeSnapshot = next;
  return true;
}

export function consumeOperationalSnapshot<T>(
  bridge: OperationalAppDataBridge<T>,
  next: T,
  equals: (first: T, second: T) => boolean,
): boolean {
  const pendingAuthoritativeSnapshot = bridge.pendingAuthoritativeSnapshot;
  bridge.current = next;
  if (pendingAuthoritativeSnapshot === null) {
    return true;
  }

  bridge.pendingAuthoritativeSnapshot = null;
  return !equals(next, pendingAuthoritativeSnapshot);
}
