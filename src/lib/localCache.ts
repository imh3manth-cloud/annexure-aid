import Dexie, { type Table } from 'dexie';
import { supabase } from '@/integrations/supabase/client';

// Local cache interfaces matching Supabase table shapes
export interface CachedBalanceRecord {
  id: string;
  account: string;
  name: string;
  address: string;
  balance: number;
  balance_date: string;
  bo_name: string;
  scheme_type: string;
  normalizedAccount: string; // pre-computed for fast lookup
}

export interface CachedMemo {
  id: string;
  serial: number;
  account: string;
  txn_id: string;
  amount: number;
  txn_date: string;
  name: string;
  address: string;
  balance: number;
  balance_date: string;
  bo_code: string;
  bo_name: string;
  status: string;
  printed: boolean;
  memo_sent_date: string | null;
  reminder_count: number;
  last_reminder_date: string | null;
  verified_date: string | null;
  reported_date: string | null;
  remarks: string;
  normalizedAccount: string;
}

export interface CachedHFTI {
  id: string;
  txn_date: string;
  txn_id: string;
  account: string;
  amount: number;
  debit_credit: string;
  bo_reference: string;
  particulars: string;
  normalizedAccount: string;
}

interface SyncMeta {
  id: string; // table name
  lastSyncedAt: string;
  recordCount: number;
}

class LocalCacheDB extends Dexie {
  balanceRecords!: Table<CachedBalanceRecord, string>;
  memos!: Table<CachedMemo, string>;
  hftiTransactions!: Table<CachedHFTI, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super('annexure_aid_cache');
    this.version(1).stores({
      balanceRecords: 'id, account, normalizedAccount, bo_name, scheme_type',
      memos: 'id, serial, account, normalizedAccount, status',
      hftiTransactions: 'id, account, normalizedAccount, txn_date',
      syncMeta: 'id',
    });
  }
}

const cacheDb = new LocalCacheDB();

const normalize = (acc: string) => acc.replace(/\D/g, '').replace(/^0+/, '') || '0';

const getUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// ============ Sync Functions ============

export async function syncBalanceRecords(onProgress?: (msg: string) => void): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;

  onProgress?.('Fetching balance records...');
  const allData: any[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('last_balance_records')
      .select('*')
      .eq('user_id', userId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    onProgress?.(`Fetched ${allData.length} balance records...`);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // Clear and rebuild cache
  await cacheDb.balanceRecords.clear();
  const cached: CachedBalanceRecord[] = allData.map(r => ({
    id: r.id,
    account: r.account,
    name: r.name,
    address: r.address || '',
    balance: Number(r.balance),
    balance_date: r.balance_date || '',
    bo_name: r.bo_name || '',
    scheme_type: r.scheme_type || '',
    normalizedAccount: normalize(r.account),
  }));

  // Batch insert
  const BATCH = 500;
  for (let i = 0; i < cached.length; i += BATCH) {
    await cacheDb.balanceRecords.bulkPut(cached.slice(i, i + BATCH));
    onProgress?.(`Cached ${Math.min(i + BATCH, cached.length)} / ${cached.length} balance records`);
  }

  await cacheDb.syncMeta.put({ id: 'balanceRecords', lastSyncedAt: new Date().toISOString(), recordCount: cached.length });
  return cached.length;
}

export async function syncMemos(onProgress?: (msg: string) => void): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;

  onProgress?.('Fetching memos...');
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  const allData = data || [];

  await cacheDb.memos.clear();
  const cached: CachedMemo[] = allData.map(r => ({
    id: r.id,
    serial: r.serial,
    account: r.account,
    txn_id: r.txn_id,
    amount: Number(r.amount),
    txn_date: r.txn_date,
    name: r.name || 'Unknown',
    address: r.address || '',
    balance: Number(r.balance),
    balance_date: r.balance_date || '',
    bo_code: r.bo_code || '',
    bo_name: r.bo_name || '',
    status: r.status,
    printed: r.printed || false,
    memo_sent_date: r.memo_sent_date,
    reminder_count: r.reminder_count || 0,
    last_reminder_date: r.last_reminder_date,
    verified_date: r.verified_date,
    reported_date: r.reported_date,
    remarks: r.remarks || '',
    normalizedAccount: normalize(r.account),
  }));

  const BATCH = 500;
  for (let i = 0; i < cached.length; i += BATCH) {
    await cacheDb.memos.bulkPut(cached.slice(i, i + BATCH));
  }

  await cacheDb.syncMeta.put({ id: 'memos', lastSyncedAt: new Date().toISOString(), recordCount: cached.length });
  onProgress?.(`Cached ${cached.length} memos`);
  return cached.length;
}

export async function syncHFTI(onProgress?: (msg: string) => void): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;

  onProgress?.('Fetching HFTI transactions...');
  const { data, error } = await supabase
    .from('hfti_transactions')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  const allData = data || [];

  await cacheDb.hftiTransactions.clear();
  const cached: CachedHFTI[] = allData.map(r => ({
    id: r.id,
    txn_date: r.txn_date,
    txn_id: r.txn_id,
    account: r.account,
    amount: Number(r.amount),
    debit_credit: r.debit_credit,
    bo_reference: r.bo_reference || '',
    particulars: r.particulars || '',
    normalizedAccount: normalize(r.account),
  }));

  const BATCH = 500;
  for (let i = 0; i < cached.length; i += BATCH) {
    await cacheDb.hftiTransactions.bulkPut(cached.slice(i, i + BATCH));
  }

  await cacheDb.syncMeta.put({ id: 'hftiTransactions', lastSyncedAt: new Date().toISOString(), recordCount: cached.length });
  onProgress?.(`Cached ${cached.length} HFTI transactions`);
  return cached.length;
}

export async function syncAll(onProgress?: (msg: string) => void): Promise<{ balance: number; memos: number; hfti: number }> {
  const balance = await syncBalanceRecords(onProgress);
  const memos = await syncMemos(onProgress);
  const hfti = await syncHFTI(onProgress);
  return { balance, memos, hfti };
}

// ============ Cache Query Functions (instant, offline) ============

export async function cachedLookupAccount(accountQuery: string) {
  const normalized = normalize(accountQuery);

  const [balanceRecord, matchingMemos, matchingHfti] = await Promise.all([
    cacheDb.balanceRecords.where('normalizedAccount').equals(normalized).first(),
    cacheDb.memos.where('normalizedAccount').equals(normalized).toArray(),
    cacheDb.hftiTransactions.where('normalizedAccount').equals(normalized).toArray(),
  ]);

  return {
    balance: balanceRecord || null,
    memos: matchingMemos,
    hftiTransactions: matchingHfti,
  };
}

export async function getCacheSyncStatus(): Promise<Record<string, SyncMeta>> {
  const all = await cacheDb.syncMeta.toArray();
  const result: Record<string, SyncMeta> = {};
  for (const m of all) result[m.id] = m;
  return result;
}

export async function isCachePopulated(): Promise<boolean> {
  const count = await cacheDb.balanceRecords.count();
  return count > 0;
}

export async function clearLocalCache(): Promise<void> {
  await Promise.all([
    cacheDb.balanceRecords.clear(),
    cacheDb.memos.clear(),
    cacheDb.hftiTransactions.clear(),
    cacheDb.syncMeta.clear(),
  ]);
}

export { cacheDb };
