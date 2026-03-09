import { supabase } from '@/integrations/supabase/client';
import { detectBOFromConfig } from './config';

// Types that mirror the Supabase tables
export interface MemoRecord {
  id?: string;
  user_id?: string;
  serial: number;
  memo_key: string;
  account: string;
  txn_id: string;
  amount: number;
  txn_date: string;
  name: string;
  address: string;
  balance: number;
  balance_date: string | null;
  bo_code: string;
  bo_name: string;
  status: 'New' | 'Pending' | 'Verified' | 'Reported';
  printed: boolean;
  memo_sent_date: string | null;
  reminder_count: number;
  last_reminder_date: string | null;
  verified_date: string | null;
  reported_date: string | null;
  remarks: string;
  created_at?: string;
}

export interface LastBalanceRecord {
  id?: string;
  user_id?: string;
  account: string;
  name: string;
  address: string;
  balance: number;
  balance_date: string | null;
  bo_name: string;
  scheme_type: string;
  uploaded_at?: string;
}

export interface DespatchRecord {
  id?: string;
  user_id?: string;
  from_memo: number;
  to_memo: number;
  post_number: string;
  despatch_date: string;
  memo_count: number;
  created_at?: string;
}

export interface HFTITransactionRecord {
  id?: string;
  user_id?: string;
  txn_date: string;
  txn_id: string;
  account: string;
  amount: number;
  debit_credit: 'D' | 'C';
  bo_reference: string;
  particulars: string;
  uploaded_at?: string;
  source_file: string;
}

export interface AppSettings {
  id?: string;
  user_id?: string;
  last_serial: number;
  threshold: number;
  group_by_bo: boolean;
}

// Get current user ID
const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

// Initialize settings for current user
export const initSettings = async () => {
  const userId = await getUserId();
  
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
export const getSettings = async (): Promise<AppSettings | null> => {
  const userId = await getUserId();
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
};

// Update settings
export const updateSettings = async (updates: Partial<AppSettings>) => {
  const userId = await getUserId();
  await supabase
    .from('app_settings')
    .update(updates)
    .eq('user_id', userId);
};

// =================== Memos ===================

export const getAllMemos = async (): Promise<MemoRecord[]> => {
  const userId = await getUserId();
  const allData: MemoRecord[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('memos')
      .select('*')
      .eq('user_id', userId)
      .order('serial', { ascending: false })
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    const batch = (data || []) as unknown as MemoRecord[];
    allData.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  
  return allData;
};

export const getMemosByStatus = async (status: string): Promise<MemoRecord[]> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('serial', { ascending: false });
  
  if (error) throw error;
  return (data || []) as unknown as MemoRecord[];
};

export const updateMemo = async (id: string, updates: Partial<MemoRecord>) => {
  const { error } = await supabase
    .from('memos')
    .update(updates)
    .eq('id', id);
  
  if (error) throw error;
};

export const clearAllMemos = async (): Promise<number> => {
  const userId = await getUserId();
  
  const { count } = await supabase
    .from('memos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  await supabase
    .from('memos')
    .delete()
    .eq('user_id', userId);
  
  // Reset serial counter
  await supabase
    .from('app_settings')
    .update({ last_serial: 0 })
    .eq('user_id', userId);
  
  return count || 0;
};

// =================== Last Balance Records ===================

export const saveLastBalanceRecords = async (records: Omit<LastBalanceRecord, 'id' | 'user_id' | 'uploaded_at'>[]) => {
  const userId = await getUserId();
  
  // Get existing records
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
      toUpdate.push({ id: existingId, updates: record });
    } else {
      toInsert.push({ ...record, user_id: userId });
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
  const { data, error } = await supabase
    .from('last_balance_records')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  return data || [];
};

export const getLastBalanceCount = async (): Promise<number> => {
  const userId = await getUserId();
  const { count, error } = await supabase
    .from('last_balance_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  if (error) throw error;
  return count || 0;
};

export const clearLastBalanceRecords = async (): Promise<void> => {
  const userId = await getUserId();
  await supabase
    .from('last_balance_records')
    .delete()
    .eq('user_id', userId);
};

export const updateLastBalanceRecord = async (id: string, updates: Partial<LastBalanceRecord>) => {
  await supabase
    .from('last_balance_records')
    .update(updates)
    .eq('id', id);
};

export const deleteLastBalanceRecord = async (id: string) => {
  await supabase
    .from('last_balance_records')
    .delete()
    .eq('id', id);
};

// =================== HFTI Transactions ===================

export const saveHFTITransactions = async (
  transactions: Omit<HFTITransactionRecord, 'id' | 'user_id' | 'uploaded_at'>[],
  sourceFile: string
): Promise<{ saved: number; skipped: number }> => {
  const userId = await getUserId();
  
  // Get existing transaction keys
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
        ...txn,
        user_id: userId,
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
  const allData: HFTITransactionRecord[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('hfti_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('txn_date', { ascending: false })
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    const batch = (data || []) as unknown as HFTITransactionRecord[];
    allData.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  
  return allData;
};

export const getHFTITransactionCount = async (): Promise<number> => {
  const userId = await getUserId();
  const { count, error } = await supabase
    .from('hfti_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  if (error) throw error;
  return count || 0;
};

export const getHFTIDateRange = async (): Promise<{ fromDate: string | null; toDate: string | null }> => {
  const userId = await getUserId();
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
  
  let results = (data || []) as unknown as HFTITransactionRecord[];
  
  // Account filter (needs client-side normalization)
  if (filters.account) {
    const searchAccount = filters.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    results = results.filter(t => {
      const txnAccount = t.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
      return txnAccount.includes(searchAccount);
    });
  }
  
  return results;
};

export const getDebitBOTransactions = async (): Promise<HFTITransactionRecord[]> => {
  const userId = await getUserId();
  const allData: HFTITransactionRecord[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('hfti_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('debit_credit', 'D')
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    const batch = (data || []) as unknown as HFTITransactionRecord[];
    allData.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  
  return allData.filter(t => t.bo_reference && t.bo_reference !== 'Unknown');
};

export const clearHFTITransactions = async (): Promise<void> => {
  const userId = await getUserId();
  await supabase
    .from('hfti_transactions')
    .delete()
    .eq('user_id', userId);
};

// =================== Despatch Records ===================

export const saveDespatchRecord = async (record: Omit<DespatchRecord, 'id' | 'user_id' | 'created_at'>): Promise<string> => {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('despatch_records')
    .insert({ ...record, user_id: userId })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
};

export const getAllDespatchRecords = async (): Promise<DespatchRecord[]> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('despatch_records')
    .select('*')
    .eq('user_id', userId)
    .order('despatch_date', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const getLastDespatchRecord = async (): Promise<DespatchRecord | null> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('despatch_records')
    .select('*')
    .eq('user_id', userId)
    .order('despatch_date', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
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
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;
  
  // Get current settings for serial number
  const settings = await getSettings();
  let lastSerial = settings?.last_serial || 0;
  
  // Get all debit BO transactions above threshold
  const debitTransactions = await getDebitBOTransactions();
  const eligibleTransactions = debitTransactions.filter(t => t.amount >= threshold);
  
  // Get existing memos to check for duplicates
  const existingMemos = await getAllMemos();
  const existingKeys = new Set(existingMemos.map(m => `${m.txn_id}|${m.account}`));
  
  // Get last balance records for account details
  const balanceRecords = await getAllLastBalanceRecords();
  
  // Create lookup map with normalized account numbers
  const balanceByAccount = new Map<string, typeof balanceRecords[0]>();
  for (const r of balanceRecords) {
    balanceByAccount.set(r.account, r);
    const normalized = r.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    balanceByAccount.set(normalized, r);
  }
  
  const pendingMemos: any[] = [];
  
  for (const txn of eligibleTransactions) {
    const memoKey = `${txn.txn_id}|${txn.account}`;
    
    if (existingKeys.has(memoKey)) {
      skipped++;
      continue;
    }
    
    const normalizedTxnAccount = txn.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
    const accountInfo = balanceByAccount.get(txn.account) || balanceByAccount.get(normalizedTxnAccount);
    
    const bo = detectBOFromConfig(txn.particulars);
    
    pendingMemos.push({
      user_id: userId,
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
  
  // Sort by BO name, then account number, then txn date for consecutive serials
  pendingMemos.sort((a, b) => {
    const boCompare = (a.bo_name || '').localeCompare(b.bo_name || '');
    if (boCompare !== 0) return boCompare;
    const accCompare = (a.account || '').localeCompare(b.account || '');
    if (accCompare !== 0) return accCompare;
    return (a.txn_date || '').localeCompare(b.txn_date || '');
  });
  
  const newMemos = pendingMemos.map(memo => {
    lastSerial++;
    return { ...memo, serial: lastSerial };
  });
  
  if (newMemos.length > 0) {
    await supabase.from('memos').insert(newMemos);
    await updateSettings({ last_serial: lastSerial });
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
  
  const balanceByAccount = new Map<string, typeof balanceRecords[0]>();
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
