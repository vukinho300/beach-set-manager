import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type SetStatus = 'free' | 'paid' | 'reserved' | 'partial';
type BedStatus = Exclude<SetStatus, 'partial'>;
type BeachId = 1 | 2;
type BedId = 1 | 2 | 3 | 4;
type BedLabel = `Bed ${BedId}`;

type BeachSet = {
  id: number;
  beach: BeachId;
  status: SetStatus;
  surname?: string;
  reservedDays?: number;
  partialNote?: string;
  updatedAt?: string;
};

type ExtraBed = {
  id: BedId;
  label: BedLabel;
  status: BedStatus;
  surname?: string;
  reservedDays?: number;
  updatedAt?: string;
};

type BeachSetMap = Record<number, BeachSet>;
type ExtraBedMap = Record<BedId, ExtraBed>;
type DetailMode = 'actions' | 'reserved' | 'partial';
type ActiveEditor = { kind: 'set'; id: number } | { kind: 'bed'; id: BedId };
type AppData = {
  sets: BeachSetMap;
  extraBeds: ExtraBedMap;
};
type BackupPayload = AppData & {
  app: 'Beach Set Manager';
  version: 3;
  exportedAt: string;
};

const TOTAL_SETS = 56;
const STORAGE_KEY = 'sunbed-beach-manager:v3';
const LEGACY_STORAGE_KEY = 'sunbed-beach-manager:v2';
const OLDEST_STORAGE_KEY = 'sunbed-beach-manager:v1';
const APP_STORAGE_KEYS = [STORAGE_KEY, LEGACY_STORAGE_KEY, OLDEST_STORAGE_KEY];
const STATUS_ORDER: SetStatus[] = ['free', 'paid', 'reserved', 'partial'];
const BED_STATUS_ORDER: BedStatus[] = ['free', 'paid', 'reserved'];
const BEACH_ONE_UPPER_ROW = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
const BEACH_ONE_LOWER_ROW = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const EXTRA_BED_IDS: BedId[] = [1, 2, 3, 4];
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

function createExtraBed(id: BedId, status: BedStatus = 'free'): ExtraBed {
  return {
    id,
    label: `Bed ${id}`,
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

function createFreeExtraBeds(): ExtraBedMap {
  return Object.fromEntries(EXTRA_BED_IDS.map((id) => [id, createExtraBed(id)])) as ExtraBedMap;
}

function createFreeAppData(): AppData {
  return {
    sets: createFreeBeachSets(),
    extraBeds: createFreeExtraBeds(),
  };
}

function isSetStatus(value: unknown): value is SetStatus {
  return typeof value === 'string' && STATUS_ORDER.includes(value as SetStatus);
}

function isBedStatus(value: unknown): value is BedStatus {
  return typeof value === 'string' && BED_STATUS_ORDER.includes(value as BedStatus);
}

function isBeachSet(value: unknown, id: number): value is BeachSet {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BeachSet>;
  return candidate.id === id && isSetStatus(candidate.status);
}

function isExtraBed(value: unknown, id: BedId): value is ExtraBed {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ExtraBed>;
  return candidate.id === id && isBedStatus(candidate.status);
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

function normalizeBed(value: unknown, id: BedId): ExtraBed {
  if (!isExtraBed(value, id)) {
    return createExtraBed(id);
  }

  return {
    id,
    label: `Bed ${id}`,
    status: value.status,
    surname: value.surname,
    reservedDays: value.reservedDays,
    updatedAt: value.updatedAt,
  };
}

function normalizeImportedBed(value: unknown, id: BedId): ExtraBed | null {
  if (!isExtraBed(value, id)) {
    return null;
  }

  const surname = typeof value.surname === 'string' ? value.surname.trim() : undefined;
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : undefined;
  const reservedDays =
    typeof value.reservedDays === 'number' && Number.isFinite(value.reservedDays)
      ? Math.max(1, Math.floor(value.reservedDays))
      : undefined;

  return {
    id,
    label: `Bed ${id}`,
    status: value.status,
    surname: surname || undefined,
    reservedDays,
    updatedAt,
  };
}

function parseSets(value: unknown, allowMissingAsFree = false): BeachSetMap | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawSets = value as Record<string, unknown>;
  const entries = Array.from({ length: TOTAL_SETS }, (_, index) => {
    const id = index + 1;
    const rawSet = rawSets[String(id)];
    const normalizedSet = rawSet
      ? normalizeImportedSet(rawSet, id)
      : allowMissingAsFree
        ? createBeachSet(id)
        : null;

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

function parseExtraBeds(value: unknown, allowMissingAsFree = false): ExtraBedMap | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawBeds = value as Record<string, unknown>;
  const entries = EXTRA_BED_IDS.map((id) => {
    const rawBed = rawBeds[String(id)];
    const normalizedBed = rawBed
      ? normalizeImportedBed(rawBed, id)
      : allowMissingAsFree
        ? createExtraBed(id)
        : null;

    if (!normalizedBed) {
      return null;
    }

    return [id, normalizedBed] as const;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(entries as Array<readonly [BedId, ExtraBed]>) as ExtraBedMap;
}

function parseImportedAppData(value: unknown): AppData | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<BackupPayload> & { sets?: unknown; extraBeds?: unknown };
  const sets = payload.sets ? parseSets(payload.sets) : parseSets(value);

  if (!sets) {
    return null;
  }

  const extraBeds = payload.extraBeds ? parseExtraBeds(payload.extraBeds) : createFreeExtraBeds();

  if (!extraBeds) {
    return null;
  }

  return { sets, extraBeds };
}

function loadLegacyStatuses(): BeachSetMap | null {
  const saved = window.localStorage.getItem(OLDEST_STORAGE_KEY);

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

function loadSavedAppData(): AppData {
  const defaults = createFreeAppData();

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved) as { sets?: unknown; extraBeds?: unknown };
      const sets = parseSets(parsed.sets, true);
      const extraBeds = parsed.extraBeds ? parseExtraBeds(parsed.extraBeds, true) : createFreeExtraBeds();

      if (sets && extraBeds) {
        return { sets, extraBeds };
      }
    }

    const legacySaved = window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacySaved) {
      const legacySets = parseSets(JSON.parse(legacySaved), true);

      if (legacySets) {
        return { sets: legacySets, extraBeds: createFreeExtraBeds() };
      }
    }

    const oldestSets = loadLegacyStatuses();

    if (oldestSets) {
      return { sets: oldestSets, extraBeds: createFreeExtraBeds() };
    }

    return defaults;
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

function updateBedStatus(bed: ExtraBed, status: BedStatus, details: Partial<ExtraBed> = {}): ExtraBed {
  const clearedDetails = status === 'reserved' ? {} : { surname: undefined, reservedDays: undefined };

  return {
    ...bed,
    ...clearedDetails,
    ...details,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function applyDailyResetToSets(currentSets: BeachSetMap): BeachSetMap {
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

function applyDailyResetToBeds(currentBeds: ExtraBedMap): ExtraBedMap {
  return Object.fromEntries(
    Object.values(currentBeds).map((bed) => {
      if (bed.status === 'reserved' && bed.reservedDays && bed.reservedDays > 1) {
        return [
          bed.id,
          {
            ...bed,
            reservedDays: bed.reservedDays - 1,
            updatedAt: new Date().toISOString(),
          },
        ];
      }

      return [bed.id, createExtraBed(bed.id)];
    }),
  ) as ExtraBedMap;
}

function createBackupPayload(appData: AppData): BackupPayload {
  return {
    app: 'Beach Set Manager',
    version: 3,
    exportedAt: new Date().toISOString(),
    sets: appData.sets,
    extraBeds: appData.extraBeds,
  };
}

function App() {
  const initialAppData = useMemo(() => loadSavedAppData(), []);
  const [sets, setSets] = useState<BeachSetMap>(() => initialAppData.sets);
  const [extraBeds, setExtraBeds] = useState<ExtraBedMap>(() => initialAppData.extraBeds);
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [jumpValue, setJumpValue] = useState('');
  const [jumpMessage, setJumpMessage] = useState<string | null>(null);
  const [highlightedSetId, setHighlightedSetId] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const setCardRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sets, extraBeds }));
  }, [sets, extraBeds]);

  const counts = useMemo(() => {
    return STATUS_ORDER.reduce(
      (summary, status) => ({
        ...summary,
        [status]: Object.values(sets).filter((set) => set.status === status).length,
      }),
      {} as Record<SetStatus, number>,
    );
  }, [sets]);

  const bedCounts = useMemo(() => {
    return BED_STATUS_ORDER.reduce(
      (summary, status) => ({
        ...summary,
        [status]: Object.values(extraBeds).filter((bed) => bed.status === status).length,
      }),
      {} as Record<BedStatus, number>,
    );
  }, [extraBeds]);

  const activeSet = activeEditor?.kind === 'set' ? sets[activeEditor.id] : null;
  const activeBed = activeEditor?.kind === 'bed' ? extraBeds[activeEditor.id] : null;

  function registerSetRef(setId: number, node: HTMLButtonElement | null) {
    setCardRefs.current[setId] = node;
  }

  function openSetEditor(setId: number) {
    setActiveEditor({ kind: 'set', id: setId });
  }

  function openBedEditor(bedId: BedId) {
    setActiveEditor({ kind: 'bed', id: bedId });
  }

  function closeEditor() {
    setActiveEditor(null);
  }

  function saveSet(setId: number, status: SetStatus, details?: Partial<BeachSet>) {
    setSets((currentSets) => ({
      ...currentSets,
      [setId]: updateSetStatus(currentSets[setId], status, details),
    }));
  }

  function saveBed(bedId: BedId, status: BedStatus, details?: Partial<ExtraBed>) {
    setExtraBeds((currentBeds) => ({
      ...currentBeds,
      [bedId]: updateBedStatus(currentBeds[bedId], status, details),
    }));
  }

  function highlightSet(setId: number) {
    if (highlightTimer.current) {
      window.clearTimeout(highlightTimer.current);
    }

    setHighlightedSetId(setId);
    highlightTimer.current = window.setTimeout(() => {
      setHighlightedSetId(null);
      highlightTimer.current = null;
    }, 1700);
  }

  function jumpToSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const setId = Number(jumpValue);

    if (!Number.isInteger(setId) || setId < 1 || setId > TOTAL_SETS) {
      setJumpMessage('Enter a set number from 1 to 56.');
      return;
    }

    setJumpMessage(`Jumped to Set ${setId}.`);
    window.requestAnimationFrame(() => {
      const card = setCardRefs.current[setId];
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.focus({ preventScroll: true });
      highlightSet(setId);
    });
  }

  function exportBackup() {
    const today = new Date().toISOString().slice(0, 10);
    const payload = createBackupPayload({ sets, extraBeds });
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
      const imported = parseImportedAppData(JSON.parse(await file.text()));

      if (!imported) {
        setBackupMessage('Import failed: this backup file is not valid for Beach Set Manager.');
        return;
      }

      const confirmed = window.confirm(
        'Import this backup and replace the current data saved on this phone/browser?',
      );

      if (confirmed) {
        setSets(imported.sets);
        setExtraBeds(imported.extraBeds);
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
        'Daily Reset will update all 56 sets and 4 extra beds.',
        '',
        '- Paid sets and beds become free.',
        '- Partial sets become free.',
        '- Reservations lose 1 reserved day.',
        '- Reservations with 1 day left become free.',
        '',
        'Continue?',
      ].join('\n'),
    );

    if (confirmed) {
      setSets((currentSets) => applyDailyResetToSets(currentSets));
      setExtraBeds((currentBeds) => applyDailyResetToBeds(currentBeds));
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
      setExtraBeds(createFreeExtraBeds());
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

      <section className="jump-panel" aria-label="Jump to a set">
        <form className="jump-form" onSubmit={jumpToSet}>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="56"
            placeholder="Jump to set number"
            value={jumpValue}
            onChange={(event) => {
              setJumpValue(event.target.value);
              setJumpMessage(null);
            }}
          />
          <button type="submit">Go</button>
        </form>
        {jumpMessage ? <p className="jump-message">{jumpMessage}</p> : null}
      </section>

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

      <details className="local-tools">
        <summary>Backups and local tools</summary>
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
      </details>

      <BeachOne
        sets={sets}
        highlightedSetId={highlightedSetId}
        onEditSet={openSetEditor}
        onRegisterSetRef={registerSetRef}
      />
      <BeachTwo
        sets={sets}
        highlightedSetId={highlightedSetId}
        onEditSet={openSetEditor}
        onRegisterSetRef={registerSetRef}
      />
      <ExtraBedsSection beds={extraBeds} counts={bedCounts} onEditBed={openBedEditor} />

      {activeSet ? (
        <SetEditorModal
          set={activeSet}
          onClose={closeEditor}
          onSave={(status, details) => saveSet(activeSet.id, status, details)}
        />
      ) : null}

      {activeBed ? (
        <BedEditorModal
          bed={activeBed}
          onClose={closeEditor}
          onSave={(status, details) => saveBed(activeBed.id, status, details)}
        />
      ) : null}
    </main>
  );
}

function BeachOne({
  sets,
  highlightedSetId,
  onEditSet,
  onRegisterSetRef,
}: {
  sets: BeachSetMap;
  highlightedSetId: number | null;
  onEditSet: (setNumber: number) => void;
  onRegisterSetRef: (setNumber: number, node: HTMLButtonElement | null) => void;
}) {
  return (
    <section className="beach-section beach-one" aria-labelledby="beach-one-heading">
      <BeachHeader
        title="Beach 1"
        subtitle="Sets 1-20"
        summary="Two vertical rows: Upper starts at 20, Lower starts at 1"
      />
      <div className="beach-one-layout beach-map" aria-label="Beach 1 physical layout">
        <div className="water-edge" aria-hidden="true">
          Sea side
        </div>
        <div className="beach-one-map">
          <SetRow
            label="Upper Row"
            sets={BEACH_ONE_UPPER_ROW}
            beachSets={sets}
            highlightedSetId={highlightedSetId}
            onEditSet={onEditSet}
            onRegisterSetRef={onRegisterSetRef}
          />
          <SetRow
            label="Lower Row"
            sets={BEACH_ONE_LOWER_ROW}
            beachSets={sets}
            highlightedSetId={highlightedSetId}
            onEditSet={onEditSet}
            onRegisterSetRef={onRegisterSetRef}
          />
        </div>
      </div>
    </section>
  );
}

function BeachTwo({
  sets,
  highlightedSetId,
  onEditSet,
  onRegisterSetRef,
}: {
  sets: BeachSetMap;
  highlightedSetId: number | null;
  onEditSet: (setNumber: number) => void;
  onRegisterSetRef: (setNumber: number, node: HTMLButtonElement | null) => void;
}) {
  return (
    <section className="beach-section beach-two" aria-labelledby="beach-two-heading">
      <BeachHeader title="Beach 2" subtitle="Sets 21-56" summary="One long promenade from 21 to 56" />
      <div className="beach-two-path beach-map" aria-label="Beach 2 long beach path">
        <span className="path-cue start-cue">Start: Set 21</span>
        <span className="path-cue scroll-cue">Scroll to Set 56</span>
        <div className="beach-two-column">
          {getSets(21, 56).map((setNumber) => (
            <SetCard
              key={setNumber}
              beachSet={sets[setNumber]}
              isHighlighted={highlightedSetId === setNumber}
              onEdit={onEditSet}
              onRegister={onRegisterSetRef}
            />
          ))}
        </div>
        <span className="path-cue end-cue">End: Set 56</span>
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
  highlightedSetId,
  onEditSet,
  onRegisterSetRef,
}: {
  label: string;
  sets: number[];
  beachSets: BeachSetMap;
  highlightedSetId: number | null;
  onEditSet: (setNumber: number) => void;
  onRegisterSetRef: (setNumber: number, node: HTMLButtonElement | null) => void;
}) {
  return (
    <section className="beach-row-column">
      <span className="row-label">{label}</span>
      <div className="map-row">
        {sets.map((setNumber) => (
          <SetCard
            key={setNumber}
            beachSet={beachSets[setNumber]}
            isHighlighted={highlightedSetId === setNumber}
            onEdit={onEditSet}
            onRegister={onRegisterSetRef}
          />
        ))}
      </div>
    </section>
  );
}

function SetCard({
  beachSet,
  isHighlighted,
  onEdit,
  onRegister,
}: {
  beachSet: BeachSet;
  isHighlighted: boolean;
  onEdit: (setNumber: number) => void;
  onRegister: (setNumber: number, node: HTMLButtonElement | null) => void;
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
      ref={(node) => onRegister(beachSet.id, node)}
      className={`set-card status-${beachSet.status}${isHighlighted ? ' set-card-highlight' : ''}`}
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

function ExtraBedsSection({
  beds,
  counts,
  onEditBed,
}: {
  beds: ExtraBedMap;
  counts: Record<BedStatus, number>;
  onEditBed: (bedId: BedId) => void;
}) {
  return (
    <section className="beach-section extra-beds-section" aria-labelledby="extra-beds-heading">
      <div className="beach-header">
        <div>
          <p className="eyebrow">Separate from sets 1-56</p>
          <h2 id="extra-beds-heading">Extra Beds</h2>
        </div>
        <span>Four individual beds outside the normal set map</span>
      </div>

      <div className="bed-status-strip" aria-label="Extra bed status totals">
        {BED_STATUS_ORDER.map((status) => (
          <span className={`bed-status-pill status-${status}`} key={status}>
            {STATUS_META[status].label}: <strong>{counts[status]}</strong>
          </span>
        ))}
      </div>

      <div className="extra-beds-grid">
        {EXTRA_BED_IDS.map((bedId) => (
          <BedCard key={bedId} bed={beds[bedId]} onEdit={onEditBed} />
        ))}
      </div>
    </section>
  );
}

function BedCard({ bed, onEdit }: { bed: ExtraBed; onEdit: (bedId: BedId) => void }) {
  return (
    <button
      className={`bed-card status-${bed.status}`}
      type="button"
      onClick={() => onEdit(bed.id)}
      aria-label={`${bed.label}, ${STATUS_META[bed.status].label}. Open editor.`}
    >
      <span className="set-number">{bed.label}</span>
      <BedIcon />
      <BedDetails bed={bed} />
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

function BedDetails({ bed }: { bed: ExtraBed }) {
  if (bed.status === 'paid') {
    return (
      <span className="card-detail">
        <strong>Paid</strong>
        <small>Bed only</small>
      </span>
    );
  }

  if (bed.status === 'reserved') {
    return (
      <span className="card-detail">
        <strong>Reserved</strong>
        <small>{bed.surname || 'No surname'}</small>
        <small>{formatDays(bed.reservedDays)}</small>
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

function BedEditorModal({
  bed,
  onClose,
  onSave,
}: {
  bed: ExtraBed;
  onClose: () => void;
  onSave: (status: BedStatus, details?: Partial<ExtraBed>) => void;
}) {
  const [mode, setMode] = useState<'actions' | 'reserved'>('actions');
  const [surname, setSurname] = useState(bed.surname ?? '');
  const [reservedDays, setReservedDays] = useState(String(bed.reservedDays ?? 1));

  function saveAndClose(status: BedStatus, details?: Partial<ExtraBed>) {
    onSave(status, details);
    onClose();
  }

  function saveReservation() {
    saveAndClose('reserved', {
      surname: surname.trim() || undefined,
      reservedDays: Math.max(1, Number(reservedDays) || 1),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bed-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Extra Beds</p>
            <h2 id="bed-editor-title">{bed.label}</h2>
          </div>
          <div className="sheet-header-actions">
            <span className={`current-status status-${bed.status}`}>
              {STATUS_META[bed.status].label}
            </span>
            <button type="button" className="close-button" aria-label="Close bed editor" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="sheet-actions">
          <button type="button" className="sheet-button free-action" onClick={() => saveAndClose('free')}>
            Mark Free
          </button>
          <button type="button" className="sheet-button paid-action" onClick={() => saveAndClose('paid')}>
            Mark Paid Bed
          </button>
          <button type="button" className="sheet-button reserved-action" onClick={() => setMode('reserved')}>
            Mark Reserved
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

function BedIcon() {
  return (
    <span className="bed-icon" aria-hidden="true">
      <span className="bed-pillow" />
      <span className="bed-frame" />
    </span>
  );
}

export default App;
