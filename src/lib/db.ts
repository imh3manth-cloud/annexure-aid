import Dexie, { Table } from 'dexie';

export interface MemoRecord {
  id?: number;
  serial: number;
  memoKey: string;
  account: string;
  txn_id: string;
  amount: number;
  txn_date: string;
  name: string;
  address: string;
  balance: number;
  balance_date: string;
  BO_Code: string;
  BO_Name: string;
  status: 'New' | 'Pending' | 'Verified' | 'Reported';
  printed: boolean;
  memo_sent_date: string | null;
  reminder_count: number;
  last_reminder_date: string | null;
  verified_date: string | null;
  reported_date: string | null;
  remarks: string;
  created_at: string;
}

export interface LastBalanceUpload {
  id?: number;
  filename: string;
  uploadDate: string;
  recordCount: number;
}

export interface LastBalanceRecord {
  id?: number;
  account: string;
  name: string;
  address: string;
  balance: number;
  balance_date: string;
  bo_name: string;
  uploaded_at: string;
}

export interface AppSettings {
  id: string;
  lastSerial: number;
  threshold: number;
  groupByBO: boolean;
}

class MemoDatabase extends Dexie {
  memos!: Table<MemoRecord>;
  settings!: Table<AppSettings>;
  lastBalanceUploads!: Table<LastBalanceUpload>;
  lastBalanceRecords!: Table<LastBalanceRecord>;

  constructor() {
    super('MemoDatabase');
    this.version(4).stores({
      memos: '++id, serial, memoKey, account, status, BO_Code, printed',
      settings: 'id',
      lastBalanceUploads: '++id, uploadDate',
      lastBalanceRecords: '++id, account, uploaded_at'
    });
  }
}

export const db = new MemoDatabase();

// Initialize default settings
export const initSettings = async () => {
  const existing = await db.settings.get('app');
  if (!existing) {
    await db.settings.add({
      id: 'app',
      lastSerial: 0,
      threshold: 10000,
      groupByBO: true
    });
  }
};

// Save last balance records to database
export const saveLastBalanceRecords = async (records: Omit<LastBalanceRecord, 'id' | 'uploaded_at'>[]) => {
  const uploadedAt = new Date().toISOString();
  const recordsWithTimestamp = records.map(r => ({
    ...r,
    uploaded_at: uploadedAt
  }));
  
  // Clear existing and add new records (or upsert by account)
  await db.transaction('rw', db.lastBalanceRecords, async () => {
    // Update or insert each record
    for (const record of recordsWithTimestamp) {
      const existing = await db.lastBalanceRecords.where('account').equals(record.account).first();
      if (existing) {
        await db.lastBalanceRecords.update(existing.id!, record);
      } else {
        await db.lastBalanceRecords.add(record);
      }
    }
  });
  
  return recordsWithTimestamp.length;
};

// Get last balance record by account
export const getLastBalanceByAccount = async (account: string): Promise<LastBalanceRecord | undefined> => {
  return db.lastBalanceRecords.where('account').equals(account).first();
};

// Get all last balance records
export const getAllLastBalanceRecords = async (): Promise<LastBalanceRecord[]> => {
  return db.lastBalanceRecords.toArray();
};

// Get last balance date (most recent upload)
export const getLastBalanceDate = async (): Promise<string | null> => {
  const records = await db.lastBalanceRecords.orderBy('uploaded_at').reverse().first();
  return records?.balance_date || null;
};

// Get count of saved balance records
export const getLastBalanceCount = async (): Promise<number> => {
  return db.lastBalanceRecords.count();
};

// Clear all last balance records
export const clearLastBalanceRecords = async (): Promise<void> => {
  await db.lastBalanceRecords.clear();
};

// Update a single last balance record
export const updateLastBalanceRecord = async (
  id: number, 
  updates: Partial<Omit<LastBalanceRecord, 'id' | 'uploaded_at'>>
): Promise<void> => {
  await db.lastBalanceRecords.update(id, updates);
};

// Delete a single last balance record
export const deleteLastBalanceRecord = async (id: number): Promise<void> => {
  await db.lastBalanceRecords.delete(id);
};
