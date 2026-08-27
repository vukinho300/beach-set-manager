import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OPERATIONAL_ADMISSION_WINDOW_MS,
  scheduleAdmissionWatchdog,
  shouldArmAdmissionWatchdog,
  shouldLockOperationalMutations,
} from './operationalWriteSafety';

afterEach(() => {
  vi.useRealTimers();
});

describe('operational write safety', () => {
  it('locks interactions immediately while a visible mutation differs from controller state', () => {
    expect(shouldLockOperationalMutations(false, 'safe', false)).toBe(true);
    expect(shouldLockOperationalMutations(true, 'securing', false)).toBe(true);
    expect(shouldLockOperationalMutations(true, 'blocked', false)).toBe(true);
    expect(shouldLockOperationalMutations(true, 'durable', false)).toBe(false);
  });

  it('turns a persistent false-Saved mismatch into a watchdog hard stop', async () => {
    vi.useFakeTimers();
    const onBlocked = vi.fn();

    expect(shouldArmAdmissionWatchdog(false, 'saved', 'safe')).toBe(true);
    scheduleAdmissionWatchdog(onBlocked);
    await vi.advanceTimersByTimeAsync(OPERATIONAL_ADMISSION_WINDOW_MS - 1);
    expect(onBlocked).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it('does not arm during normal controller securing or durable server retry', () => {
    expect(shouldArmAdmissionWatchdog(false, 'saving', 'securing')).toBe(false);
    expect(shouldArmAdmissionWatchdog(false, 'pending', 'durable')).toBe(false);
  });
});
