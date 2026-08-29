import type { SharedConflictDiscardResult } from './sharedStateController';

export const CONFLICT_DISCARD_CONFIRMATION = [
  "This device has an unsaved preserved change.",
  'The shared server data will NOT be changed.',
  "This device's unsent local change will be permanently discarded.",
  'Save the preserved recovery file first if this change may matter.',
  'Cancel keeps the change safely preserved.',
].join('\n\n');

export async function confirmAndDiscardPendingConflict(
  confirmAction: (message: string) => boolean,
  discard: () => Promise<SharedConflictDiscardResult>,
): Promise<SharedConflictDiscardResult | { status: 'cancelled' }> {
  if (!confirmAction(CONFLICT_DISCARD_CONFIRMATION)) {
    return { status: 'cancelled' };
  }
  return discard();
}
