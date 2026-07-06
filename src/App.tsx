import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type SetStatus = 'free' | 'paid' | 'reserved' | 'partial';
type BeachId = 1 | 2;

type BeachSet = {
  id: number;
  beach: BeachId;
  status: SetStatus;
  surname?: string;
  reservedDays?: number;
  partialNote?: string;
  updatedAt?: string;
};

type BeachSetMap = Record<number, BeachSet>;
type DetailMode = 'actions' | 'reserved' | 'partial';
type BackupPayload = {
  app: 'Beach Set Manager';
  version: 2;
  exportedAt: string;
  sets: BeachSetMap;
};

const TOTAL_SETS = 56;
const STORAGE_KEY = 'sunbed-beach-manager:v2';
const LEGACY_STORAGE_KEY = 'sunbed-beach-manager:v1';
const APP_STORAGE_KEYS = [STORAGE_KEY, LEGACY_STORAGE_KEY];
const STATUS_ORDER: SetStatus[] = ['free', 'paid', 'reserved', 'partial'];
const PARTIAL_OPTIONS = ['1 sunbed only', '1 sunbed + parasol', '2 sunbeds no parasol'];

const STATUS_META: Record<SetStatus, { label: string; shortLabel: string }> = {
  free: { label: 'Free', shortLabel: 'Free' },
  paid: { label: 'Paid', shortLabel: 'Paid' },
  reserved: { label: 'Reserved', shortLabel: 'Reserved' },
  partial: { label: 'Partial', shortLabel: 'Partial' },
};

function getBeachForSet(id: number): BeachId {
  return id <= 20 ? 1 : 2;
}

function createBeachSet(id: number, status: SetStatus = 'free'): BeachSet {
  return {
    id,
    beach: getBeachForSet(id),
    status,
  };
}

function createFreeBeachSets(): BeachSetMap {
  return Object.fromEntries(
    Array.from({ length: TOTAL_SETS }, (_, index) => {
      const id = index + 1;
      return [id, createBeachSet(id)];
    }),
  ) as BeachSetMap;
}

function isSetStatus(value: unknown): value is SetStatus {
  return typeof value === 'string' && STATUS_ORDER.includes(value as SetStatus);
}

function isBeachSet(value: unknown, id: number): value is BeachSet {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BeachSet>;
  return candidate.id === id && isSetStatus(candidate.status);
}

function normalizeSet(value: unknown, id: number): BeachSet {
  if (!isBeachSet(value, id)) {
    return createBeachSet(id);
  }

  return {
    id,
    beach: getBeachForSet(id),
    status: value.status,
    surname: value.surname,
    reservedDays: value.reservedDays,
    partialNote: value.partialNote,
    updatedAt: value.updatedAt,
  };
}

function normalizeImportedSet(value: unknown, id: number): BeachSet | null {
  if (!isBeachSet(value, id)) {
    return null;
  }

  const surname = typeof value.surname === 'string' ? value.surname.trim() : undefined;
  const partialNote = typeof value.partialNote === 'string' ? value.partialNote.trim() : undefined;
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : undefined;
  const reservedDays =
    typeof value.reservedDays === 'number' && Number.isFinite(value.reservedDays)
      ? Math.max(1, Math.floor(value.reservedDays))
      : undefined;

  return {
    id,
    beach: getBeachForSet(id),
    status: value.status,
    surname: surname || undefined,
    reservedDays,
    partialNote: partialNote || undefined,
    updatedAt,
  };
}

function parseImportedSets(value: unknown): BeachSetMap | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<BackupPayload> & { sets?: unknown };
  const rawSets = payload.sets;

  if (!rawSets || typeof rawSets !== 'object') {
    return null;
  }

  const entries = Array.from({ length: TOTAL_SETS }, (_, index) => {
    const id = index + 1;
    const rawSet = (rawSets as Record<string, unknown>)[String(id)];
    const normalizedSet = normalizeImportedSet(rawSet, id);

    if (!normalizedSet) {
      return null;
    }

    return [id, normalizedSet] as const;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(entries as Array<readonly [number, BeachSet]>) as BeachSetMap;
}

function loadLegacyStatuses(): BeachSetMap | null {
  const saved = window.localStorage.getItem(LEGACY_STORAGE_KEY);

  if (!saved) {
    return null;
  }

  const parsed = JSON.parse(saved) as Partial<Record<string, unknown>>;

  return Object.fromEntries(
    Array.from({ length: TOTAL_SETS }, (_, index) => {
      const id = index + 1;
      const status = parsed[String(id)];
      return [id, createBeachSet(id, isSetStatus(status) ? status : 'free')];
    }),
  ) as BeachSetMap;
}

function loadSavedSets(): BeachSetMap {
  const defaults = createFreeBeachSets();

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return loadLegacyStatuses() ?? defaults;
    }

    const parsed = JSON.parse(saved) as Partial<Record<string, unknown>>;

    return Object.fromEntries(
      Object.keys(defaults).map((setNumber) => {
        const id = Number(setNumber);
        return [id, normalizeSet(parsed[setNumber], id)];
      }),
    ) as BeachSetMap;
  } catch {
    return defaults;
  }
}

function getSets(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function updateSetStatus(set: BeachSet, status: SetStatus, details: Partial<BeachSet> = {}): BeachSet {
  const clearedDetails =
    status === 'reserved'
      ? { partialNote: undefined }
      : status === 'partial'
        ? { surname: undefined, reservedDays: undefined }
        : { surname: undefined, reservedDays: undefined, partialNote: undefined };

  return {
    ...set,
    ...clearedDetails,
    ...details,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function applyDailyReset(currentSets: BeachSetMap): BeachSetMap {
  return Object.fromEntries(
    Object.values(currentSets).map((set) => {
      if (set.status === 'reserved' && set.reservedDays && set.reservedDays > 1) {
        return [
          set.id,
          {
            ...set,
            reservedDays: set.reservedDays - 1,
            updatedAt: new Date().toISOString(),
          },
        ];
      }

      return [set.id, createBeachSet(set.id)];
    }),
  ) as BeachSetMap;
}

function createBackupPayload(sets: BeachSetMap): BackupPayload {
  return {
    app: 'Beach Set Manager',
    version: 2,
    exportedAt: new Date().toISOString(),
    sets,
  };
}

function App() {
  const [sets, setSets] = useState<BeachSetMap>(() => loadSavedSets());
  const [activeSetId, setActiveSetId] = useState<number | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  }, [sets]);

  const counts = useMemo(() => {
    return STATUS_ORDER.reduce(
      (summary, status) => ({
        ...summary,
        [status]: Object.values(sets).filter((set) => set.status === status).length,
      }),
      {} as Record<SetStatus, number>,
    );
  }, [sets]);

  const activeSet = activeSetId ? sets[activeSetId] : null;

  function openEditor(setId: number) {
    setActiveSetId(setId);
  }

  function closeEditor() {
    setActiveSetId(null);
  }

  function saveSet(setId: number, status: SetStatus, details?: Partial<BeachSet>) {
    setSets((currentSets) => ({
      ...currentSets,
      [setId]: updateSetStatus(currentSets[setId], status, details),
    }));
  }

  function exportBackup() {
    const today = new Date().toISOString().slice(0, 10);
    const payload = createBackupPayload(sets);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `beach-sets-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setBackupMessage('Backup exported.');
  }

  function openImportPicker() {
    setBackupMessage(null);
    importInputRef.current?.click();
  }

  async function importBackup(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const imported = parseImportedSets(JSON.parse(await file.text()));

      if (!imported) {
        setBackupMessage('Import failed: this backup file is not valid for Beach Set Manager.');
        return;
      }

      const confirmed = window.confirm(
        'Import this backup and replace the current data saved on this phone/browser?',
      );

      if (confirmed) {
        setSets(imported);
        closeEditor();
        setBackupMessage('Backup imported.');
      }
    } catch {
      setBackupMessage('Import failed: choose a valid JSON backup file.');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  function resetDay() {
    const confirmed = window.confirm(
      [
        'Daily Reset will update all 56 sets.',
        '',
        '- Paid sets become free.',
        '- Partial sets become free.',
        '- Reservations lose 1 reserved day.',
        '- Reservations with 1 day left become free.',
        '',
        'Continue?',
      ].join('\n'),
    );

    if (confirmed) {
      setSets((currentSets) => applyDailyReset(currentSets));
      closeEditor();
      setBackupMessage('Daily reset complete.');
    }
  }

  function resetAppData() {
    const typed = window.prompt(
      'Danger: this clears all Beach Set Manager data saved in this browser. Type RESET to continue.',
    );

    if (typed === 'RESET') {
      APP_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      setSets(createFreeBeachSets());
      closeEditor();
      setBackupMessage('All app data cleared.');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Summer shift board</p>
          <h1>Beach Set Manager</h1>
        </div>
        <button className="reset-button" type="button" onClick={resetDay}>
          Daily Reset
        </button>
      </header>

      <section className="status-strip" aria-label="Current set totals by status">
        {STATUS_ORDER.map((status) => (
          <div className={`status-pill status-${status}`} key={status}>
            <span>{STATUS_META[status].label}</span>
            <strong>{counts[status]}</strong>
          </div>
        ))}
      </section>

      <section className="legend" aria-label="Status color legend">
        {STATUS_ORDER.map((status) => (
          <span className={`legend-item status-${status}`} key={status}>
            <span className="legend-dot" />
            {STATUS_META[status].label}
          </span>
        ))}
      </section>

      <section className="local-tools" aria-label="Local storage and backup tools">
        <p>Saved locally on this device. Other phones have separate data.</p>
        <div className="tool-buttons">
          <button type="button" className="tool-button" onClick={exportBackup}>
            Export Backup
          </button>
          <button type="button" className="tool-button" onClick={openImportPicker}>
            Import Backup
          </button>
        </div>
        <input
          ref={importInputRef}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importBackup(event.target.files?.[0])}
        />
        {backupMessage ? <p className="backup-message">{backupMessage}</p> : null}
        <button type="button" className="danger-link" onClick={resetAppData}>
          Reset app data
        </button>
      </section>

      <BeachOne sets={sets} onEditSet={openEditor} />
      <BeachTwo sets={sets} onEditSet={openEditor} />

      {activeSet ? (
        <SetEditorModal
          set={activeSet}
          onClose={closeEditor}
          onSave={(status, details) => saveSet(activeSet.id, status, details)}
        />
      ) : null}
    </main>
  );
}

function BeachOne({
  sets,
  onEditSet,
}: {
  sets: BeachSetMap;
  onEditSet: (setNumber: number) => void;
}) {
  return (
    <section className="beach-section beach-one" aria-labelledby="beach-one-heading">
      <BeachHeader
        title="Beach 1"
        subtitle="Sets 1-20"
        summary="Upper row 10-20, lower row 1-9"
      />
      <div className="beach-one-layout" aria-label="Beach 1 physical layout">
        <div className="shoreline" aria-hidden="true" />
        <SetRow label="Upper row" sets={getSets(10, 20)} beachSets={sets} onEditSet={onEditSet} />
        <SetRow label="Lower row" sets={getSets(1, 9)} beachSets={sets} onEditSet={onEditSet} />
      </div>
    </section>
  );
}

function BeachTwo({
  sets,
  onEditSet,
}: {
  sets: BeachSetMap;
  onEditSet: (setNumber: number) => void;
}) {
  return (
    <section className="beach-section beach-two" aria-labelledby="beach-two-heading">
      <BeachHeader title="Beach 2" subtitle="Sets 21-56" summary="Long scrollable beach section" />
      <div className="beach-two-grid" aria-label="Beach 2 set grid">
        {getSets(21, 56).map((setNumber) => (
          <SetCard key={setNumber} beachSet={sets[setNumber]} onEdit={onEditSet} />
        ))}
      </div>
    </section>
  );
}

function BeachHeader({
  title,
  subtitle,
  summary,
}: {
  title: string;
  subtitle: string;
  summary: string;
}) {
  return (
    <div className="beach-header">
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h2 id={title === 'Beach 1' ? 'beach-one-heading' : 'beach-two-heading'}>{title}</h2>
      </div>
      <span>{summary}</span>
    </div>
  );
}

function SetRow({
  label,
  sets,
  beachSets,
  onEditSet,
}: {
  label: string;
  sets: number[];
  beachSets: BeachSetMap;
  onEditSet: (setNumber: number) => void;
}) {
  return (
    <div className="layout-row">
      <span className="row-label">{label}</span>
      <div className="scroll-row">
        {sets.map((setNumber) => (
          <SetCard key={setNumber} beachSet={beachSets[setNumber]} onEdit={onEditSet} />
        ))}
      </div>
    </div>
  );
}

function SetCard({
  beachSet,
  onEdit,
}: {
  beachSet: BeachSet;
  onEdit: (setNumber: number) => void;
}) {
  const longPressTimer = useRef<number | null>(null);

  function clearLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress() {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      onEdit(beachSet.id);
      longPressTimer.current = null;
    }, 520);
  }

  return (
    <button
      className={`set-card status-${beachSet.status}`}
      type="button"
      onClick={() => onEdit(beachSet.id)}
      onDoubleClick={() => onEdit(beachSet.id)}
      onPointerDown={startLongPress}
      onPointerLeave={clearLongPress}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      aria-label={`Set ${beachSet.id}, ${STATUS_META[beachSet.status].label}. Open editor.`}
    >
      <span className="set-number">Set {beachSet.id}</span>
      <SetIcon status={beachSet.status} />
      <SetDetails beachSet={beachSet} />
    </button>
  );
}

function SetDetails({ beachSet }: { beachSet: BeachSet }) {
  if (beachSet.status === 'paid') {
    return (
      <span className="card-detail">
        <strong>Paid</strong>
        <small>2 beds + parasol</small>
      </span>
    );
  }

  if (beachSet.status === 'reserved') {
    return (
      <span className="card-detail">
        <strong>Reserved</strong>
        <small>{beachSet.surname || 'No surname'}</small>
        <small>{formatDays(beachSet.reservedDays)}</small>
      </span>
    );
  }

  if (beachSet.status === 'partial') {
    return (
      <span className="card-detail">
        <strong>Partial</strong>
        <small>{beachSet.partialNote || 'Add note'}</small>
      </span>
    );
  }

  return (
    <span className="card-detail">
      <strong>Free</strong>
      <small>Available</small>
    </span>
  );
}

function formatDays(days?: number) {
  if (!days || days < 1) {
    return 'Days not set';
  }

  return days === 1 ? '1 day' : `${days} days`;
}

function SetEditorModal({
  set,
  onClose,
  onSave,
}: {
  set: BeachSet;
  onClose: () => void;
  onSave: (status: SetStatus, details?: Partial<BeachSet>) => void;
}) {
  const [mode, setMode] = useState<DetailMode>('actions');
  const [surname, setSurname] = useState(set.surname ?? '');
  const [reservedDays, setReservedDays] = useState(String(set.reservedDays ?? 1));
  const [partialNote, setPartialNote] = useState(set.partialNote ?? PARTIAL_OPTIONS[0]);

  function saveAndClose(status: SetStatus, details?: Partial<BeachSet>) {
    onSave(status, details);
    onClose();
  }

  function saveReservation() {
    saveAndClose('reserved', {
      surname: surname.trim() || undefined,
      reservedDays: Math.max(1, Number(reservedDays) || 1),
    });
  }

  function savePartial() {
    saveAndClose('partial', {
      partialNote: partialNote.trim() || 'Partial payment',
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Beach {set.beach}</p>
            <h2 id="set-editor-title">Set {set.id}</h2>
          </div>
          <div className="sheet-header-actions">
            <span className={`current-status status-${set.status}`}>
              {STATUS_META[set.status].label}
            </span>
            <button type="button" className="close-button" aria-label="Close set editor" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="sheet-actions">
          <button type="button" className="sheet-button free-action" onClick={() => saveAndClose('free')}>
            Mark Free
          </button>
          <button type="button" className="sheet-button paid-action" onClick={() => saveAndClose('paid')}>
            Mark Paid Full Set
          </button>
          <button type="button" className="sheet-button reserved-action" onClick={() => setMode('reserved')}>
            Mark Reserved
          </button>
          <button type="button" className="sheet-button partial-action" onClick={() => setMode('partial')}>
            Mark Partial Payment
          </button>
        </div>

        {mode === 'reserved' ? (
          <div className="detail-panel">
            <label>
              Customer surname
              <input
                type="text"
                value={surname}
                onChange={(event) => setSurname(event.target.value)}
                placeholder="e.g. Novak"
                autoComplete="family-name"
              />
            </label>
            <label>
              Reserved days
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={reservedDays}
                onChange={(event) => setReservedDays(event.target.value)}
              />
            </label>
            <button type="button" className="sheet-button reserved-action" onClick={saveReservation}>
              Save Reservation
            </button>
          </div>
        ) : null}

        {mode === 'partial' ? (
          <div className="detail-panel">
            <div className="quick-options" aria-label="Partial payment quick options">
              {PARTIAL_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={partialNote === option ? 'quick-option selected' : 'quick-option'}
                  key={option}
                  onClick={() => setPartialNote(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <label>
              Custom note
              <textarea
                value={partialNote}
                onChange={(event) => setPartialNote(event.target.value)}
                rows={3}
                placeholder="Write what was paid"
              />
            </label>
            <button type="button" className="sheet-button partial-action" onClick={savePartial}>
              Save Partial Payment
            </button>
          </div>
        ) : null}

        <button type="button" className="cancel-button" onClick={onClose}>
          Cancel
        </button>
      </section>
    </div>
  );
}

function SetIcon({ status }: { status: SetStatus }) {
  return (
    <span className={`set-icon icon-${status}`} aria-hidden="true">
      <span className="parasol">
        <span className="canopy" />
        <span className="pole" />
      </span>
      <span className="sunbeds">
        <span className="sunbed" />
        <span className="sunbed" />
      </span>
    </span>
  );
}

export default App;
