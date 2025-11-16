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

  constructor() {
    super('MemoDatabase');
    this.version(2).stores({
      memos: '++id, serial, memoKey, account, status, BO_Code, printed',
      settings: 'id',
      lastBalanceUploads: '++id, uploadDate'
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
