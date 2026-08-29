import { useState } from 'react';
import type { SharedConflictDiscardResult } from './sharedStateController';
import {
  confirmAndDiscardPendingConflict,
} from './conflictRecovery';

export function ConflictDiscardAction({
  onDiscard,
}: {
  onDiscard: () => Promise<SharedConflictDiscardResult>;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function discard() {
    if (working) {
      return;
    }
    const confirmation = await confirmAndDiscardPendingConflict(
      (message) => window.confirm(message),
      async () => {
        setWorking(true);
        setError(null);
        try {
          return await onDiscard();
        } finally {
          setWorking(false);
        }
      },
    );
    if (confirmation.status === 'rejected') {
      setError(confirmation.message);
    }
  }

  return (
    <section className="conflict-discard" aria-labelledby="conflict-discard-heading">
      <h2 id="conflict-discard-heading">Discard this device's unsaved change</h2>
      <p>
        Use this only when the preserved change is no longer wanted. Save the recovery file first
        if it may still matter.
      </p>
      <button
        className="auth-submit conflict-discard-action"
        type="button"
        disabled={working}
        onClick={() => void discard()}
      >
        {working ? 'Loading current shared data...' : 'Discard local change and use current shared data'}
      </button>
      {error ? <p className="conflict-discard-error" role="alert">{error}</p> : null}
    </section>
  );
}
