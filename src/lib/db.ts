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
  scheme_type: string;
  uploaded_at: string;
}

export interface DespatchRecord {
  id?: number;
  from_memo: number;
  to_memo: number;
  post_number: string;
  despatch_date: string;
  memo_count: number;
  created_at: string;
}

export interface AppSettings {
  id: string;
  lastSerial: number;
  threshold: number;
  groupByBO: boolean;
}

// NEW: HFTI Transaction interface for master register
export interface HFTITransactionRecord {
  id?: number;
  txn_date: string;
  txn_id: string;
  account: string;
  amount: number;
  debit_credit: 'D' | 'C';
  bo_reference: string;
  particulars: string;
  uploaded_at: string;
  source_file: string;
}

class MemoDatabase extends Dexie {
  memos!: Table<MemoRecord>;
  settings!: Table<AppSettings>;
  lastBalanceUploads!: Table<LastBalanceUpload>;
  lastBalanceRecords!: Table<LastBalanceRecord>;
  despatchRecords!: Table<DespatchRecord>;
  hftiTransactions!: Table<HFTITransactionRecord>;

  constructor() {
    super('MemoDatabase');
    this.version(7).stores({
      memos: '++id, serial, memoKey, account, status, BO_Code, printed',
      settings: 'id',
      lastBalanceUploads: '++id, uploadDate',
      lastBalanceRecords: '++id, account, uploaded_at, scheme_type',
      despatchRecords: '++id, despatch_date, created_at',
      hftiTransactions: '++id, txn_date, txn_id, account, debit_credit, uploaded_at'
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

// Save despatch record
export const saveDespatchRecord = async (record: Omit<DespatchRecord, 'id' | 'created_at'>): Promise<number> => {
  return db.despatchRecords.add({
    ...record,
    created_at: new Date().toISOString()
  });
};

// Get all despatch records
export const getAllDespatchRecords = async (): Promise<DespatchRecord[]> => {
  return db.despatchRecords.orderBy('despatch_date').reverse().toArray();
};

// Get last despatch record
export const getLastDespatchRecord = async (): Promise<DespatchRecord | undefined> => {
  return db.despatchRecords.orderBy('despatch_date').reverse().first();
};

// Get days since last despatch
export const getDaysSinceLastDespatch = async (): Promise<number | null> => {
  const lastRecord = await getLastDespatchRecord();
  if (!lastRecord) return null;
  const lastDate = new Date(lastRecord.despatch_date);
  const today = new Date();
  const diffTime = today.getTime() - lastDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// ============ HFTI Transaction Register Functions ============

// Save HFTI transactions (append mode - no duplicates based on txn_id + account + amount + date)
export const saveHFTITransactions = async (
  transactions: Omit<HFTITransactionRecord, 'id' | 'uploaded_at'>[],
  sourceFile: string
): Promise<{ saved: number; skipped: number }> => {
  const uploadedAt = new Date().toISOString();
  
  // Get existing transaction keys to check duplicates
  const existing = await db.hftiTransactions.toArray();
  const existingKeys = new Set(existing.map(t => `${t.txn_id}|${t.account}|${t.amount}|${t.txn_date}`));
  
  const newTransactions: HFTITransactionRecord[] = [];
  let skipped = 0;
  
  for (const txn of transactions) {
    const key = `${txn.txn_id}|${txn.account}|${txn.amount}|${txn.txn_date}`;
    if (existingKeys.has(key)) {
      skipped++;
    } else {
      existingKeys.add(key); // Prevent duplicates within same batch
      newTransactions.push({
        ...txn,
        uploaded_at: uploadedAt,
        source_file: sourceFile
      });
    }
  }
  
  if (newTransactions.length > 0) {
    await db.hftiTransactions.bulkAdd(newTransactions);
  }
  
  return { saved: newTransactions.length, skipped };
};

// Get all HFTI transactions
export const getAllHFTITransactions = async (): Promise<HFTITransactionRecord[]> => {
  return db.hftiTransactions.orderBy('txn_date').reverse().toArray();
};

// Get HFTI transactions count
export const getHFTITransactionCount = async (): Promise<number> => {
  return db.hftiTransactions.count();
};

// Get HFTI date range (oldest and newest transaction dates)
export const getHFTIDateRange = async (): Promise<{ fromDate: string | null; toDate: string | null }> => {
  const transactions = await db.hftiTransactions.toArray();
  if (transactions.length === 0) {
    return { fromDate: null, toDate: null };
  }
  
  const dates = transactions.map(t => t.txn_date).sort();
  return {
    fromDate: dates[0],
    toDate: dates[dates.length - 1]
  };
};

// Get HFTI transactions with filters
export const getFilteredHFTITransactions = async (filters: {
  startDate?: string;
  endDate?: string;
  debitCredit?: 'D' | 'C' | 'all';
  minAmount?: number;
  maxAmount?: number;
  account?: string;
}): Promise<HFTITransactionRecord[]> => {
  let collection = db.hftiTransactions.toCollection();
  
  let transactions = await collection.toArray();
  
  // Apply filters
  if (filters.startDate) {
    transactions = transactions.filter(t => t.txn_date >= filters.startDate!);
  }
  if (filters.endDate) {
    transactions = transactions.filter(t => t.txn_date <= filters.endDate!);
  }
  if (filters.debitCredit && filters.debitCredit !== 'all') {
    transactions = transactions.filter(t => t.debit_credit === filters.debitCredit);
  }
  if (filters.minAmount !== undefined) {
    transactions = transactions.filter(t => t.amount >= filters.minAmount!);
  }
  if (filters.maxAmount !== undefined) {
    transactions = transactions.filter(t => t.amount <= filters.maxAmount!);
  }
  if (filters.account) {
    const searchAccount = filters.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    transactions = transactions.filter(t => {
      const txnAccount = t.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
      return txnAccount.includes(searchAccount);
    });
  }
  
  return transactions.sort((a, b) => new Date(b.txn_date).getTime() - new Date(a.txn_date).getTime());
};

// Get debit-only BO transactions for SB-45 register
export const getDebitBOTransactions = async (): Promise<HFTITransactionRecord[]> => {
  const transactions = await db.hftiTransactions.where('debit_credit').equals('D').toArray();
  return transactions.filter(t => t.bo_reference && t.bo_reference !== 'Unknown');
};

// Clear all HFTI transactions
export const clearHFTITransactions = async (): Promise<void> => {
  await db.hftiTransactions.clear();
};

// ============ Generate Memos from HFTI Transactions ============

import { detectBOFromConfig } from './config';

// Generate memos from HFTI debit BO transactions
export const generateMemosFromHFTI = async (
  threshold: number = 10000
): Promise<{ created: number; skipped: number; errors: string[] }> => {
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;
  
  // Get current settings for serial number
  const settings = await db.settings.get('app');
  let lastSerial = settings?.lastSerial || 0;
  
  // Get all debit BO transactions above threshold
  const debitTransactions = await getDebitBOTransactions();
  const eligibleTransactions = debitTransactions.filter(t => t.amount >= threshold);
  
  // Get existing memos to check for duplicates (by txn_id + account)
  const existingMemos = await db.memos.toArray();
  const existingKeys = new Set(existingMemos.map(m => `${m.txn_id}|${m.account}`));
  
  // Get last balance records for account details
  const balanceRecords = await db.lastBalanceRecords.toArray();
  
  // Create lookup map with normalized account numbers
  const balanceByAccount = new Map<string, typeof balanceRecords[0]>();
  for (const r of balanceRecords) {
    // Store with original account
    balanceByAccount.set(r.account, r);
    // Also store with normalized version (no leading zeros)
    const normalized = r.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    balanceByAccount.set(normalized, r);
  }
  
  console.log('Balance records count:', balanceRecords.length);
  console.log('Balance accounts sample:', balanceRecords.slice(0, 5).map(r => r.account));
  
  const newMemos: MemoRecord[] = [];
  
  for (const txn of eligibleTransactions) {
    const memoKey = `${txn.txn_id}|${txn.account}`;
    
    // Skip if memo already exists
    if (existingKeys.has(memoKey)) {
      skipped++;
      continue;
    }
    
    // Get account details from last balance - try multiple formats
    const normalizedTxnAccount = txn.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    let accountInfo = balanceByAccount.get(txn.account) || balanceByAccount.get(normalizedTxnAccount);
    
    // Debug logging
    if (!accountInfo) {
      console.log('No match for HFTI account:', txn.account, 'normalized:', normalizedTxnAccount);
    } else {
      console.log('Found match for account:', txn.account, '->', accountInfo.name);
    }
    
    // Detect BO code from particulars
    const bo = detectBOFromConfig(txn.particulars);
    
    lastSerial++;
    
    const memo: MemoRecord = {
      serial: lastSerial,
      memoKey,
      account: txn.account,
      txn_id: txn.txn_id,
      amount: txn.amount,
      txn_date: txn.txn_date,
      name: accountInfo?.name || 'Unknown',
      address: accountInfo?.address || '',
      balance: accountInfo?.balance || 0,
      balance_date: accountInfo?.balance_date || '',
      BO_Code: bo.code,
      BO_Name: bo.name,
      status: 'New',
      printed: false,
      memo_sent_date: null,
      reminder_count: 0,
      last_reminder_date: null,
      verified_date: null,
      reported_date: null,
      remarks: '',
      created_at: new Date().toISOString()
    };
    
    newMemos.push(memo);
    existingKeys.add(memoKey); // Prevent duplicates in same batch
    created++;
  }
  
  // Bulk add new memos
  if (newMemos.length > 0) {
    await db.memos.bulkAdd(newMemos);
    // Update last serial in settings
    await db.settings.update('app', { lastSerial });
  }
  
  return { created, skipped, errors };
};

// Get count of eligible HFTI transactions (debit BO above threshold)
export const getEligibleHFTICount = async (threshold: number = 10000): Promise<number> => {
  const debitTransactions = await getDebitBOTransactions();
  
  // Get existing memos
  const existingMemos = await db.memos.toArray();
  const existingKeys = new Set(existingMemos.map(m => `${m.txn_id}|${m.account}`));
  
  // Count eligible transactions not already in memos
  return debitTransactions.filter(t => 
    t.amount >= threshold && 
    !existingKeys.has(`${t.txn_id}|${t.account}`)
  ).length;
};

// Clear all memos
export const clearAllMemos = async (): Promise<number> => {
  const count = await db.memos.count();
  await db.memos.clear();
  // Reset serial counter
  await db.settings.update('app', { lastSerial: 0 });
  return count;
};
