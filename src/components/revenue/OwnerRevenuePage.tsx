import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  calculateRevenueDifference,
  type RevenueDifference,
} from '../../domain/revenue';
import type { ActiveLocationMembership } from '../../services/location/locationMemberships';
import type { OwnerRevenueState } from '../../services/revenue/useOwnerRevenue';

function formatEuro(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

function Difference({ difference }: { difference: RevenueDifference }) {
  if (difference.status === 'missing') {
    return <span>Not available until Real Revenue is entered</span>;
  }
  if (difference.status === 'real-zero-mismatch') {
    return (
      <span className="owner-revenue-alert">
        Difference unavailable — Real Revenue is €0
      </span>
    );
  }
  return (
    <span className={difference.alert ? 'owner-revenue-alert' : undefined}>
      {difference.percentage.toFixed(1)}%
    </span>
  );
}

export function OwnerRevenuePage({
  state,
  memberships,
  businessDate,
  onBusinessDateChange,
  onSave,
}: {
  state: OwnerRevenueState;
  memberships: ActiveLocationMembership[];
  businessDate: string;
  onBusinessDateChange: (date: string) => void;
  onSave: (locationId: string, realRevenue: number) => Promise<boolean>;
}) {
  const managerMemberships = useMemo(
    () => memberships.filter((membership) => (
      membership.role === 'PLATFORM_OWNER'
      || membership.role === 'LOCATION_ADMIN'
    )),
    [memberships],
  );
  const [entryLocationId, setEntryLocationId] = useState(
    () => managerMemberships[0]?.locationId ?? '',
  );
  const [realRevenue, setRealRevenue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!managerMemberships.some((item) => item.locationId === entryLocationId)) {
      setEntryLocationId(managerMemberships[0]?.locationId ?? '');
    }
  }, [entryLocationId, managerMemberships]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(realRevenue);
    if (!Number.isFinite(value) || value < 0) {
      setSaveMessage('Enter a valid non-negative Real Revenue amount.');
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const saved = await onSave(entryLocationId, value);
      setSaveMessage(saved ? 'Real Revenue saved.' : 'Real Revenue could not be saved.');
      if (saved) {
        setRealRevenue('');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="owner-revenue-page">
      <header className="report-hero">
        <p className="eyebrow">Boss-only reconciliation</p>
        <h2>Real Revenue vs App Revenue</h2>
        <label className="owner-revenue-date">
          <span>Business date</span>
          <input
            type="date"
            value={businessDate}
            onChange={(event) => onBusinessDateChange(event.target.value)}
          />
        </label>
      </header>

      <form className="settings-section owner-revenue-form" onSubmit={(event) => void submit(event)}>
        <h3>Enter Real Revenue</h3>
        <label>
          <span>Location</span>
          <select
            value={entryLocationId}
            onChange={(event) => setEntryLocationId(event.target.value)}
            disabled={saving}
          >
            {managerMemberships.map((membership) => (
              <option value={membership.locationId} key={membership.locationId}>
                {membership.location.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <input
            type="date"
            value={businessDate}
            onChange={(event) => onBusinessDateChange(event.target.value)}
            disabled={saving}
          />
        </label>
        <label>
          <span>Real Revenue</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={realRevenue}
            onChange={(event) => setRealRevenue(event.target.value)}
            disabled={saving}
            required
          />
        </label>
        <button className="tool-button" type="submit" disabled={saving || !entryLocationId}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveMessage ? <p className="backup-message" role="status">{saveMessage}</p> : null}
      </form>

      {state.status === 'loading' || state.status === 'idle' ? (
        <p className="report-empty">Loading authorized location revenue…</p>
      ) : null}
      {state.status === 'unavailable' ? (
        <p className="auth-error" role="alert">{state.message}</p>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <section className="owner-revenue-combined" aria-label="Combined revenue">
            <div>
              <span>Combined App Revenue</span>
              <strong>
                {state.summary.combinedAppRevenue === null
                  ? 'Incomplete'
                  : formatEuro(state.summary.combinedAppRevenue)}
              </strong>
              {state.summary.missingAppRevenueLocations.length > 0 ? (
                <small>
                  No recorded report: {state.summary.missingAppRevenueLocations.join(', ')}
                </small>
              ) : <small>Petalon + Koversada</small>}
            </div>
            <div>
              <span>Combined Real Revenue</span>
              <strong>
                {state.summary.combinedRealRevenue === null
                  ? 'Incomplete'
                  : formatEuro(state.summary.combinedRealRevenue)}
              </strong>
              {state.summary.missingRealRevenueLocations.length > 0 ? (
                <small>
                  Not entered: {state.summary.missingRealRevenueLocations.join(', ')}
                </small>
              ) : <small>Petalon + Koversada</small>}
            </div>
          </section>

          <div className="owner-revenue-location-grid">
            {state.summary.locations.map((item) => {
              const difference = item.appRevenue === null
                ? { status: 'missing' } as const
                : calculateRevenueDifference(item.appRevenue, item.realRevenue);
              return (
                <section className="owner-revenue-location" key={item.membership.locationId}>
                  <h3>{item.membership.location.name}</h3>
                  <p>
                    <span>App Revenue</span>
                    <strong>
                      {item.appRevenue === null ? 'No recorded report' : formatEuro(item.appRevenue)}
                    </strong>
                  </p>
                  <p>
                    <span>Real Revenue</span>
                    <strong>
                      {item.realRevenue === null ? 'Not entered' : formatEuro(item.realRevenue)}
                    </strong>
                  </p>
                  <p className="owner-revenue-difference">
                    <span>Difference</span>
                    <Difference difference={difference} />
                  </p>
                </section>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
