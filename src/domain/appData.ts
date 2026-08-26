export type SetStatus = 'free' | 'paid' | 'reserved' | 'left';
export type BedStatus = Exclude<SetStatus, 'left'>;
export type BeachId = 1 | 2;
export type BedId = 1 | 2 | 3 | 4;
export type BedLabel = `Bed ${BedId}`;
export type ReservationSurname = string;
export type SetPriceMode = 'fixed' | 'special';
export type AquaparkTicketType =
  | '30min'
  | '1hour'
  | 'half_day'
  | 'one_day'
  | 'one_week'
  | 'custom_days';
export type AquaparkPriceMode = 'default' | 'special';

export type BeachSet = {
  id: number;
  beach: BeachId;
  status: SetStatus;
  beachReservationId?: string;
  surname?: string;
  reservedDays?: number;
  price?: number;
  priceMode?: SetPriceMode;
  dailySaleId?: string;
  updatedAt?: string;
};

export type ExtraBed = {
  id: BedId;
  label: BedLabel;
  status: BedStatus;
  beachReservationId?: string;
  surname?: string;
  reservedDays?: number;
  price?: number;
  priceMode?: SetPriceMode;
  dailySaleId?: string;
  updatedAt?: string;
};

export type BeachReservation = {
  id: string;
  surname: string;
  startDate: string;
  endDate: string;
  totalAmountPaid?: number;
  paymentRecordedAt?: string;
  reservedDays?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type BeachReservationDetails = {
  surname: string;
  startDate: string;
  endDate: string;
  totalAmountPaid?: number;
  notes?: string;
};

export type AquaparkEntry = {
  id: string;
  wristbands: number[];
  ticketType: AquaparkTicketType;
  defaultUnitPrice: number;
  unitPrice: number;
  totalPrice: number;
  priceMode: AquaparkPriceMode;
  status: 'active' | 'closed';
  isLegacyPrice?: boolean;
  startAt: string;
  endAt?: string;
  extraMinutes: number;
  validUntil?: string;
  customDays?: number;
  dailyUnitPrice?: number;
  description?: string;
  createdAt: string;
  closedAt?: string;
  returnedWristbands: number[];
};

export type NonNumberedSunbedSale = {
  id: string;
  quantity: number;
  totalAmount: number;
  description?: string;
  createdAt: string;
};

export type DailySale =
  | {
      id: string;
      kind: 'beach_set';
      setId: number;
      amount: number;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'aquapark_entry';
      entryId: string;
      ticketType: AquaparkTicketType;
      wristbandCount: number;
      unitPrice: number;
      customDays?: number;
      amount: number;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'bed';
      bedId: BedId;
      amount: number;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'sunbed';
      sunbedSaleId: string;
      quantity: number;
      amount: number;
      createdAt: string;
    };

export type TransactionType =
  | 'beach_set'
  | 'bed'
  | 'sunbed'
  | 'beach_reservation'
  | 'aquapark';

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  createdAt: string;
  status?: 'active' | 'deleted';
  deletedAt?: string;
  resourceId?: string;
  resourceLabel?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type ArchivedDailyReport = {
  date: string;
  archivedAt: string;
  transactions: Transaction[];
};

export type AquaparkEntryDetails = {
  wristbands: number[];
  ticketType: AquaparkTicketType;
  specialPrice?: number;
  customDays?: number;
  dailyUnitPrice?: number;
  extraMinutes?: number;
  description?: string;
};

export type BeachSetMap = Record<number, BeachSet>;
export type ExtraBedMap = Record<BedId, ExtraBed>;

export type AppData = {
  sets: BeachSetMap;
  extraBeds: ExtraBedMap;
  beachReservations: BeachReservation[];
  savedSurnames: ReservationSurname[];
  sunbedSales: NonNumberedSunbedSale[];
  aquaparkEntries: AquaparkEntry[];
  transactions: Transaction[];
  reportArchive: ArchivedDailyReport[];
  lastAutomaticResetDate?: string;
};

export const TOTAL_SETS = 56;
export const EXTRA_BED_IDS: BedId[] = [1, 2, 3, 4];
export const AQUAPARK_TICKETS: Record<
  AquaparkTicketType,
  { label: string; price: number }
> = {
  '30min': { label: '30 minutes', price: 12 },
  '1hour': { label: '1 hour', price: 14 },
  half_day: { label: 'Half day', price: 20 },
  one_day: { label: 'One day', price: 25 },
  one_week: { label: 'One week', price: 99 },
  custom_days: { label: 'Custom Days', price: 15 },
};

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBeachForSet(id: number): BeachId {
  return id <= 20 ? 1 : 2;
}

export function createBeachSet(id: number, status: SetStatus = 'free'): BeachSet {
  return {
    id,
    beach: getBeachForSet(id),
    status,
  };
}

export function createExtraBed(id: BedId, status: BedStatus = 'free'): ExtraBed {
  return {
    id,
    label: `Bed ${id}`,
    status,
  };
}

export function createFreeBeachSets(): BeachSetMap {
  return Object.fromEntries(
    Array.from({ length: TOTAL_SETS }, (_, index) => {
      const id = index + 1;
      return [id, createBeachSet(id)];
    }),
  ) as BeachSetMap;
}

export function createFreeExtraBeds(): ExtraBedMap {
  return Object.fromEntries(
    EXTRA_BED_IDS.map((id) => [id, createExtraBed(id)]),
  ) as ExtraBedMap;
}

export function createDefaultAppData(date = new Date()): AppData {
  return {
    sets: createFreeBeachSets(),
    extraBeds: createFreeExtraBeds(),
    beachReservations: [],
    savedSurnames: [],
    sunbedSales: [],
    aquaparkEntries: [],
    transactions: [],
    reportArchive: [],
    lastAutomaticResetDate: getLocalDateKey(date),
  };
}
