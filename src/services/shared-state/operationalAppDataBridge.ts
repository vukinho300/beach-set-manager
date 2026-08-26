export type OperationalAppDataBridge<T> = {
  current: T;
  suppressNextEmission: boolean;
};

export function createOperationalAppDataBridge<T>(
  initial: T,
): OperationalAppDataBridge<T> {
  return { current: initial, suppressNextEmission: false };
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
  bridge.suppressNextEmission = true;
  return true;
}

export function consumeOperationalSnapshot<T>(
  bridge: OperationalAppDataBridge<T>,
  next: T,
): boolean {
  bridge.current = next;
  if (!bridge.suppressNextEmission) {
    return true;
  }

  bridge.suppressNextEmission = false;
  return false;
}
