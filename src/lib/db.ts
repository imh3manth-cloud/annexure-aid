import { supabase } from '@/integrations/supabase/client';
import { detectBOFromConfig } from './config';

// Types with ORIGINAL field names for backward compatibility with existing code
export interface MemoRecord {
  id?: string | number;
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

export interface LastBalanceRecord {
  id?: string | number;
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
  id?: string | number;
  from_memo: number;
  to_memo: number;
  post_number: string;
  despatch_date: string;
  memo_count: number;
  created_at: string;
}

export interface HFTITransactionRecord {
  id?: string | number;
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

export interface AppSettings {
  id: string;
  lastSerial: number;
  threshold: number;
  groupByBO: boolean;
}

// Helper to get user ID - returns null if not authenticated
const getUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// Transform DB row to MemoRecord (with BO_Name, BO_Code, memoKey)
const dbToMemo = (row: any): MemoRecord => ({
  id: row.id,
  serial: row.serial,
  memoKey: row.memo_key,
  account: row.account,
  txn_id: row.txn_id,
  amount: Number(row.amount),
  txn_date: row.txn_date,
  name: row.name,
  address: row.address,
  balance: Number(row.balance),
  balance_date: row.balance_date || '',
  BO_Code: row.bo_code,
  BO_Name: row.bo_name,
  status: row.status as MemoRecord['status'],
  printed: row.printed,
  memo_sent_date: row.memo_sent_date,
  reminder_count: row.reminder_count,
  last_reminder_date: row.last_reminder_date,
  verified_date: row.verified_date,
  reported_date: row.reported_date,
  remarks: row.remarks,
  created_at: row.created_at
});

// Transform MemoRecord to DB row format
const memoToDb = (memo: Partial<MemoRecord>, userId: string): any => {
  const result: any = { user_id: userId };
  if (memo.serial !== undefined) result.serial = memo.serial;
  if (memo.memoKey !== undefined) result.memo_key = memo.memoKey;
  if (memo.account !== undefined) result.account = memo.account;
  if (memo.txn_id !== undefined) result.txn_id = memo.txn_id;
  if (memo.amount !== undefined) result.amount = memo.amount;
  if (memo.txn_date !== undefined) result.txn_date = memo.txn_date;
  if (memo.name !== undefined) result.name = memo.name;
  if (memo.address !== undefined) result.address = memo.address;
  if (memo.balance !== undefined) result.balance = memo.balance;
  if (memo.balance_date !== undefined) result.balance_date = memo.balance_date || null;
  if (memo.BO_Code !== undefined) result.bo_code = memo.BO_Code;
  if (memo.BO_Name !== undefined) result.bo_name = memo.BO_Name;
  if (memo.status !== undefined) result.status = memo.status;
  if (memo.printed !== undefined) result.printed = memo.printed;
  if (memo.memo_sent_date !== undefined) result.memo_sent_date = memo.memo_sent_date;
  if (memo.reminder_count !== undefined) result.reminder_count = memo.reminder_count;
  if (memo.last_reminder_date !== undefined) result.last_reminder_date = memo.last_reminder_date;
  if (memo.verified_date !== undefined) result.verified_date = memo.verified_date;
  if (memo.reported_date !== undefined) result.reported_date = memo.reported_date;
  if (memo.remarks !== undefined) result.remarks = memo.remarks;
  return result;
};

// Transform DB row to LastBalanceRecord
const dbToBalance = (row: any): LastBalanceRecord => ({
  id: row.id,
  account: row.account,
  name: row.name,
  address: row.address,
  balance: Number(row.balance),
  balance_date: row.balance_date || '',
  bo_name: row.bo_name,
  scheme_type: row.scheme_type,
  uploaded_at: row.uploaded_at
});

// Transform DB row to HFTITransactionRecord
const dbToHFTI = (row: any): HFTITransactionRecord => ({
  id: row.id,
  txn_date: row.txn_date,
  txn_id: row.txn_id,
  account: row.account,
  amount: Number(row.amount),
  debit_credit: row.debit_credit as 'D' | 'C',
  bo_reference: row.bo_reference,
  particulars: row.particulars,
  uploaded_at: row.uploaded_at,
  source_file: row.source_file
});

// Transform DB row to DespatchRecord
const dbToDespatch = (row: any): DespatchRecord => ({
  id: row.id,
  from_memo: row.from_memo,
  to_memo: row.to_memo,
  post_number: row.post_number,
  despatch_date: row.despatch_date,
  memo_count: row.memo_count,
  created_at: row.created_at
});

// Initialize settings for current user
export const initSettings = async () => {
  const userId = await getUserId();
  if (!userId) return;
  
  const { data: existing } = await supabase
    .from('app_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (!existing) {
    await supabase.from('app_settings').insert({
      user_id: userId,
      last_serial: 0,
      threshold: 10000,
      group_by_bo: true
    });
  }
};

// Get settings
const getSettings = async (): Promise<AppSettings | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (!data) return null;
  
  return {
    id: 'app',
    lastSerial: data.last_serial,
    threshold: data.threshold,
    groupByBO: data.group_by_bo
  };
};

// Update settings
const updateSettings = async (updates: Partial<{ lastSerial: number; threshold: number; groupByBO: boolean }>) => {
  const userId = await getUserId();
  if (!userId) return;
  
  const dbUpdates: any = {};
  if (updates.lastSerial !== undefined) dbUpdates.last_serial = updates.lastSerial;
  if (updates.threshold !== undefined) dbUpdates.threshold = updates.threshold;
  if (updates.groupByBO !== undefined) dbUpdates.group_by_bo = updates.groupByBO;
  
  await supabase
    .from('app_settings')
    .update(dbUpdates)
    .eq('user_id', userId);
};

// =================== Memos ===================

const getAllMemos = async (): Promise<MemoRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('user_id', userId)
    .order('serial', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(dbToMemo);
};

const getMemosByStatus = async (status: string): Promise<MemoRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('serial', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(dbToMemo);
};

const getMemosBySerialRange = async (fromSerial: number, toSerial: number): Promise<MemoRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('user_id', userId)
    .gte('serial', fromSerial)
    .lte('serial', toSerial)
    .order('serial', { ascending: true });
  
  if (error) throw error;
  return (data || []).map(dbToMemo);
};

const getMemosByIds = async (ids: (string | number)[]): Promise<MemoRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('user_id', userId)
    .in('id', ids.map(String));
  
  if (error) throw error;
  return (data || []).map(dbToMemo);
};

const updateMemo = async (id: string | number, updates: Partial<MemoRecord>) => {
  const userId = await getUserId();
  if (!userId) return;
  
  // Convert field names
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.printed !== undefined) dbUpdates.printed = updates.printed;
  if (updates.memo_sent_date !== undefined) dbUpdates.memo_sent_date = updates.memo_sent_date;
  if (updates.reminder_count !== undefined) dbUpdates.reminder_count = updates.reminder_count;
  if (updates.last_reminder_date !== undefined) dbUpdates.last_reminder_date = updates.last_reminder_date;
  if (updates.verified_date !== undefined) dbUpdates.verified_date = updates.verified_date;
  if (updates.reported_date !== undefined) dbUpdates.reported_date = updates.reported_date;
  if (updates.remarks !== undefined) dbUpdates.remarks = updates.remarks;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.address !== undefined) dbUpdates.address = updates.address;
  if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
  if (updates.balance_date !== undefined) dbUpdates.balance_date = updates.balance_date || null;
  
  await supabase
    .from('memos')
    .update(dbUpdates)
    .eq('id', String(id));
};

export const clearAllMemos = async (): Promise<number> => {
  const userId = await getUserId();
  if (!userId) return 0;
  
  const { count } = await supabase
    .from('memos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  await supabase
    .from('memos')
    .delete()
    .eq('user_id', userId);
  
  await updateSettings({ lastSerial: 0 });
  
  return count || 0;
};

// =================== Last Balance Records ===================

export const saveLastBalanceRecords = async (records: Omit<LastBalanceRecord, 'id' | 'uploaded_at'>[]) => {
  const userId = await getUserId();
  if (!userId) return 0;
  
  const { data: existing } = await supabase
    .from('last_balance_records')
    .select('id, account')
    .eq('user_id', userId);
  
  const existingMap = new Map((existing || []).map(r => [r.account, r.id]));
  
  const toInsert: any[] = [];
  const toUpdate: { id: string; updates: any }[] = [];
  
  for (const record of records) {
    const existingId = existingMap.get(record.account);
    if (existingId) {
      toUpdate.push({ 
        id: existingId, 
        updates: {
          name: record.name,
          address: record.address,
          balance: record.balance,
          balance_date: record.balance_date || null,
          bo_name: record.bo_name,
          scheme_type: record.scheme_type
        }
      });
    } else {
      toInsert.push({ 
        user_id: userId,
        account: record.account,
        name: record.name,
        address: record.address,
        balance: record.balance,
        balance_date: record.balance_date || null,
        bo_name: record.bo_name,
        scheme_type: record.scheme_type
      });
    }
  }
  
  if (toInsert.length > 0) {
    await supabase.from('last_balance_records').insert(toInsert);
  }
  
  for (const { id, updates } of toUpdate) {
    await supabase.from('last_balance_records').update(updates).eq('id', id);
  }
  
  return records.length;
};

export const getAllLastBalanceRecords = async (): Promise<LastBalanceRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('last_balance_records')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  return (data || []).map(dbToBalance);
};

export const getLastBalanceCount = async (): Promise<number> => {
  const userId = await getUserId();
  if (!userId) return 0;
  
  const { count, error } = await supabase
    .from('last_balance_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  if (error) throw error;
  return count || 0;
};

export const getLastBalanceDate = async (): Promise<string | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  
  const { data } = await supabase
    .from('last_balance_records')
    .select('balance_date')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })
    .limit(1);
  
  return data?.[0]?.balance_date || null;
};

export const clearLastBalanceRecords = async (): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;
  
  await supabase
    .from('last_balance_records')
    .delete()
    .eq('user_id', userId);
};

export const updateLastBalanceRecord = async (id: string | number, updates: Partial<Omit<LastBalanceRecord, 'id' | 'uploaded_at'>>) => {
  await supabase
    .from('last_balance_records')
    .update(updates as any)
    .eq('id', String(id));
};

export const deleteLastBalanceRecord = async (id: string | number) => {
  await supabase
    .from('last_balance_records')
    .delete()
    .eq('id', String(id));
};

// =================== HFTI Transactions ===================

export const saveHFTITransactions = async (
  transactions: Omit<HFTITransactionRecord, 'id' | 'uploaded_at'>[],
  sourceFile: string
): Promise<{ saved: number; skipped: number }> => {
  const userId = await getUserId();
  if (!userId) return { saved: 0, skipped: 0 };
  
  const { data: existing } = await supabase
    .from('hfti_transactions')
    .select('txn_id, account, amount, txn_date')
    .eq('user_id', userId);
  
  const existingKeys = new Set(
    (existing || []).map(t => `${t.txn_id}|${t.account}|${t.amount}|${t.txn_date}`)
  );
  
  const newTransactions: any[] = [];
  let skipped = 0;
  
  for (const txn of transactions) {
    const key = `${txn.txn_id}|${txn.account}|${txn.amount}|${txn.txn_date}`;
    if (existingKeys.has(key)) {
      skipped++;
    } else {
      existingKeys.add(key);
      newTransactions.push({
        user_id: userId,
        txn_date: txn.txn_date,
        txn_id: txn.txn_id,
        account: txn.account,
        amount: txn.amount,
        debit_credit: txn.debit_credit,
        bo_reference: txn.bo_reference,
        particulars: txn.particulars,
        source_file: sourceFile
      });
    }
  }
  
  if (newTransactions.length > 0) {
    await supabase.from('hfti_transactions').insert(newTransactions);
  }
  
  return { saved: newTransactions.length, skipped };
};

export const getAllHFTITransactions = async (): Promise<HFTITransactionRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('hfti_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('txn_date', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(dbToHFTI);
};

export const getHFTITransactionCount = async (): Promise<number> => {
  const userId = await getUserId();
  if (!userId) return 0;
  
  const { count, error } = await supabase
    .from('hfti_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  if (error) throw error;
  return count || 0;
};

export const getHFTIDateRange = async (): Promise<{ fromDate: string | null; toDate: string | null }> => {
  const userId = await getUserId();
  if (!userId) return { fromDate: null, toDate: null };
  
  const { data } = await supabase
    .from('hfti_transactions')
    .select('txn_date')
    .eq('user_id', userId)
    .order('txn_date', { ascending: true });
  
  if (!data || data.length === 0) {
    return { fromDate: null, toDate: null };
  }
  
  return {
    fromDate: data[0].txn_date,
    toDate: data[data.length - 1].txn_date
  };
};

export const getFilteredHFTITransactions = async (filters: {
  startDate?: string;
  endDate?: string;
  debitCredit?: 'D' | 'C' | 'all';
  minAmount?: number;
  maxAmount?: number;
  account?: string;
}): Promise<HFTITransactionRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  let query = supabase
    .from('hfti_transactions')
    .select('*')
    .eq('user_id', userId);
  
  if (filters.startDate) {
    query = query.gte('txn_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('txn_date', filters.endDate);
  }
  if (filters.debitCredit && filters.debitCredit !== 'all') {
    query = query.eq('debit_credit', filters.debitCredit);
  }
  if (filters.minAmount !== undefined) {
    query = query.gte('amount', filters.minAmount);
  }
  if (filters.maxAmount !== undefined) {
    query = query.lte('amount', filters.maxAmount);
  }
  
  const { data, error } = await query.order('txn_date', { ascending: false });
  
  if (error) throw error;
  
  let results = (data || []).map(dbToHFTI);
  
  if (filters.account) {
    const searchAccount = filters.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    results = results.filter(t => {
      const txnAccount = t.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
      return txnAccount.includes(searchAccount);
    });
  }
  
  return results;
};

const getDebitBOTransactions = async (): Promise<HFTITransactionRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('hfti_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('debit_credit', 'D');
  
  if (error) throw error;
  return (data || []).map(dbToHFTI).filter(t => t.bo_reference && t.bo_reference !== 'Unknown');
};

export const clearHFTITransactions = async (): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;
  
  await supabase
    .from('hfti_transactions')
    .delete()
    .eq('user_id', userId);
};

// =================== Despatch Records ===================

export const saveDespatchRecord = async (record: Omit<DespatchRecord, 'id' | 'created_at'>): Promise<number> => {
  const userId = await getUserId();
  if (!userId) return 0;
  
  const { data, error } = await supabase
    .from('despatch_records')
    .insert({ 
      user_id: userId,
      from_memo: record.from_memo,
      to_memo: record.to_memo,
      post_number: record.post_number,
      despatch_date: record.despatch_date,
      memo_count: record.memo_count
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return 1; // Return a number for compatibility
};

export const getAllDespatchRecords = async (): Promise<DespatchRecord[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  
  const { data, error } = await supabase
    .from('despatch_records')
    .select('*')
    .eq('user_id', userId)
    .order('despatch_date', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(dbToDespatch);
};

export const getLastDespatchRecord = async (): Promise<DespatchRecord | undefined> => {
  const userId = await getUserId();
  if (!userId) return undefined;
  
  const { data, error } = await supabase
    .from('despatch_records')
    .select('*')
    .eq('user_id', userId)
    .order('despatch_date', { ascending: false })
    .limit(1);
  
  if (error && error.code !== 'PGRST116') throw error;
  return data?.[0] ? dbToDespatch(data[0]) : undefined;
};

export const getDaysSinceLastDespatch = async (): Promise<number | null> => {
  const lastRecord = await getLastDespatchRecord();
  if (!lastRecord) return null;
  
  const lastDate = new Date(lastRecord.despatch_date);
  const today = new Date();
  const diffTime = today.getTime() - lastDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// =================== Generate Memos from HFTI ===================

export const generateMemosFromHFTI = async (
  threshold: number = 10000
): Promise<{ created: number; skipped: number; errors: string[] }> => {
  const userId = await getUserId();
  if (!userId) return { created: 0, skipped: 0, errors: ['Not authenticated'] };
  
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;
  
  const settings = await getSettings();
  let lastSerial = settings?.lastSerial || 0;
  
  const debitTransactions = await getDebitBOTransactions();
  const eligibleTransactions = debitTransactions.filter(t => t.amount >= threshold);
  
  const existingMemos = await getAllMemos();
  const existingKeys = new Set(existingMemos.map(m => `${m.txn_id}|${m.account}`));
  
  const balanceRecords = await getAllLastBalanceRecords();
  
  const balanceByAccount = new Map<string, LastBalanceRecord>();
  for (const r of balanceRecords) {
    balanceByAccount.set(r.account, r);
    const normalized = r.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    balanceByAccount.set(normalized, r);
  }
  
  const newMemos: any[] = [];
  
  for (const txn of eligibleTransactions) {
    const memoKey = `${txn.txn_id}|${txn.account}`;
    
    if (existingKeys.has(memoKey)) {
      skipped++;
      continue;
    }
    
    const normalizedTxnAccount = txn.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    const accountInfo = balanceByAccount.get(txn.account) || balanceByAccount.get(normalizedTxnAccount);
    
    const bo = detectBOFromConfig(txn.particulars);
    
    lastSerial++;
    
    newMemos.push({
      user_id: userId,
      serial: lastSerial,
      memo_key: memoKey,
      account: txn.account,
      txn_id: txn.txn_id,
      amount: txn.amount,
      txn_date: txn.txn_date,
      name: accountInfo?.name || 'Unknown',
      address: accountInfo?.address || '',
      balance: accountInfo?.balance || 0,
      balance_date: accountInfo?.balance_date || null,
      bo_code: bo.code,
      bo_name: bo.name,
      status: 'New',
      printed: false,
      memo_sent_date: null,
      reminder_count: 0,
      last_reminder_date: null,
      verified_date: null,
      reported_date: null,
      remarks: ''
    });
    
    existingKeys.add(memoKey);
    created++;
  }
  
  if (newMemos.length > 0) {
    await supabase.from('memos').insert(newMemos);
    await updateSettings({ lastSerial });
  }
  
  return { created, skipped, errors };
};

export const getEligibleHFTICount = async (threshold: number = 10000): Promise<number> => {
  const debitTransactions = await getDebitBOTransactions();
  const existingMemos = await getAllMemos();
  const existingKeys = new Set(existingMemos.map(m => `${m.txn_id}|${m.account}`));
  
  return debitTransactions.filter(t => 
    t.amount >= threshold && 
    !existingKeys.has(`${t.txn_id}|${t.account}`)
  ).length;
};

export const syncMemoNamesFromBalance = async (): Promise<{ updated: number; notFound: number }> => {
  const memos = await getAllMemos();
  const balanceRecords = await getAllLastBalanceRecords();
  
  if (balanceRecords.length === 0) {
    return { updated: 0, notFound: memos.length };
  }
  
  const balanceByAccount = new Map<string, LastBalanceRecord>();
  for (const r of balanceRecords) {
    balanceByAccount.set(r.account, r);
    const normalized = r.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    balanceByAccount.set(normalized, r);
  }
  
  let updated = 0;
  let notFound = 0;
  
  for (const memo of memos) {
    const normalizedAccount = memo.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    const accountInfo = balanceByAccount.get(memo.account) || balanceByAccount.get(normalizedAccount);
    
    if (accountInfo && memo.id) {
      await updateMemo(memo.id, {
        name: accountInfo.name,
        address: accountInfo.address,
        balance: accountInfo.balance,
        balance_date: accountInfo.balance_date
      });
      updated++;
    } else {
      notFound++;
    }
  }
  
  return { updated, notFound };
};

// =================== DB Compatibility Layer ===================
// This provides a Dexie-like interface for backward compatibility

export const db = {
  memos: {
    async toArray() {
      return getAllMemos();
    },
    orderBy(_field: string) {
      return {
        reverse() {
          return {
            async toArray() {
              return getAllMemos();
            }
          };
        },
        async toArray() {
          return getAllMemos();
        }
      };
    },
    where(field: string) {
      return {
        equals(value: any) {
          return {
            async first() {
              const memos = await getAllMemos();
              return memos.find((m: any) => m[field] === value);
            },
            async toArray() {
              if (field === 'status') {
                return getMemosByStatus(value);
              }
              const memos = await getAllMemos();
              return memos.filter((m: any) => m[field] === value);
            },
            async sortBy(sortField: string) {
              const memos = field === 'status' 
                ? await getMemosByStatus(value) 
                : (await getAllMemos()).filter((m: any) => m[field] === value);
              return memos.sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return -1;
                if (a[sortField] > b[sortField]) return 1;
                return 0;
              });
            }
          };
        },
        between(low: number, high: number, includeLow = true, includeHigh = true) {
          return {
            async toArray() {
              return getMemosBySerialRange(low, high);
            }
          };
        }
      };
    },
    filter(predicate: (memo: MemoRecord) => boolean) {
      return {
        async toArray() {
          const memos = await getAllMemos();
          return memos.filter(predicate);
        }
      };
    },
    async bulkGet(ids: (string | number)[]) {
      return getMemosByIds(ids);
    },
    async count() {
      const memos = await getAllMemos();
      return memos.length;
    },
    async update(id: string | number, updates: Partial<MemoRecord>) {
      await updateMemo(id, updates);
    },
    async clear() {
      await clearAllMemos();
    },
    async bulkAdd(memos: MemoRecord[]) {
      const userId = await getUserId();
      if (!userId) return [];
      
      const toInsert = memos.map(m => memoToDb(m, userId));
      await supabase.from('memos').insert(toInsert);
      return memos.map((_, i) => i);
    }
  },
  settings: {
    async get(id: string) {
      if (id === 'app') {
        return getSettings();
      }
      return null;
    },
    async toArray() {
      const settings = await getSettings();
      return settings ? [settings] : [];
    },
    async update(id: string, updates: Partial<AppSettings>) {
      if (id === 'app') {
        await updateSettings(updates);
      }
    },
    async add(settings: AppSettings) {
      await initSettings();
    },
    async clear() {
      // Settings are per-user and managed automatically
    },
    async bulkAdd(settingsArray: AppSettings[]) {
      await initSettings();
    }
  },
  lastBalanceRecords: {
    async toArray() {
      return getAllLastBalanceRecords();
    },
    async count() {
      return getLastBalanceCount();
    },
    where(field: string) {
      return {
        equals(value: any) {
          return {
            async first() {
              const records = await getAllLastBalanceRecords();
              return records.find((r: any) => r[field] === value);
            }
          };
        }
      };
    },
    async clear() {
      await clearLastBalanceRecords();
    }
  },
  hftiTransactions: {
    async toArray() {
      return getAllHFTITransactions();
    },
    async count() {
      return getHFTITransactionCount();
    },
    where(field: string) {
      return {
        equals(value: any) {
          return {
            async toArray() {
              const txns = await getAllHFTITransactions();
              return txns.filter((t: any) => t[field] === value);
            }
          };
        }
      };
    },
    async clear() {
      await clearHFTITransactions();
    }
  },
  despatchRecords: {
    async toArray() {
      return getAllDespatchRecords();
    },
    orderBy(_field: string) {
      return {
        reverse() {
          return {
            async toArray() {
              return getAllDespatchRecords();
            },
            async first() {
              const records = await getAllDespatchRecords();
              return records[0];
            }
          };
        }
      };
    }
  }
};
