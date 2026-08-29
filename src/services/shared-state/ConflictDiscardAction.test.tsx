import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConflictDiscardAction } from './ConflictDiscardAction';
import {
  CONFLICT_DISCARD_CONFIRMATION,
  confirmAndDiscardPendingConflict,
} from './conflictRecovery';

describe('preserved-conflict recovery action', () => {
  it('renders a separate destructive recovery action without replacing recovery export', () => {
    const markup = renderToStaticMarkup(
      <ConflictDiscardAction onDiscard={async () => ({ status: 'discarded' })} />,
    );

    expect(markup).toContain('Discard this device&#x27;s unsaved change');
    expect(markup).toContain('Discard local change and use current shared data');
    expect(markup).toContain('Save the recovery file first');
  });

  it('makes cancellation the safe default and does not invoke discard', async () => {
    const discard = vi.fn(async () => ({ status: 'discarded' as const }));

    await expect(confirmAndDiscardPendingConflict(() => false, discard)).resolves.toEqual({
      status: 'cancelled',
    });
    expect(discard).not.toHaveBeenCalled();
  });

  it('uses the exact strong confirmation before invoking discard', async () => {
    const confirm = vi.fn(() => true);
    const discard = vi.fn(async () => ({ status: 'discarded' as const }));

    await expect(confirmAndDiscardPendingConflict(confirm, discard)).resolves.toEqual({
      status: 'discarded',
    });
    expect(confirm).toHaveBeenCalledWith(CONFLICT_DISCARD_CONFIRMATION);
    expect(discard).toHaveBeenCalledTimes(1);
  });
});
