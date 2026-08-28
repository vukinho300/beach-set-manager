import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OPERATIONAL_ADMISSION_WINDOW_MS,
  canSwitchOperationalLocation,
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

  it('allows a location switch only from a fully confirmed safe state', () => {
    expect(canSwitchOperationalLocation(true, 'saved', 'safe', false)).toBe(true);
    expect(canSwitchOperationalLocation(false, 'saved', 'safe', false)).toBe(false);
    expect(canSwitchOperationalLocation(true, 'saving', 'securing', false)).toBe(false);
    expect(canSwitchOperationalLocation(true, 'pending', 'durable', false)).toBe(false);
    expect(canSwitchOperationalLocation(true, 'saved', 'blocked', false)).toBe(false);
    expect(canSwitchOperationalLocation(true, 'saved', 'safe', true)).toBe(false);
  });
});
