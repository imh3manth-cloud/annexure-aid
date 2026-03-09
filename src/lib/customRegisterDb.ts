import { supabase } from '@/integrations/supabase/client';

export interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  options?: string[]; // for select type
  width?: string;
}

export interface CustomRegister {
  id: string;
  name: string;
  description: string;
  columns: ColumnDef[];
  presets: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomRegisterRow {
  id: string;
  register_id: string;
  row_data: Record<string, any>;
  row_order: number;
  created_at: string;
  updated_at: string;
}

const getUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// ========== Register CRUD ==========

export const getAllRegisters = async (): Promise<CustomRegister[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('custom_registers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    columns: (r.columns as any) || [],
    presets: r.presets,
    created_at: r.created_at,
    updated_at: r.updated_at
  }));
};

export const getRegister = async (id: string): Promise<CustomRegister | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('custom_registers')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    columns: (data.columns as any) || [],
    presets: data.presets,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

export const createRegister = async (register: { name: string; description: string; columns: ColumnDef[]; presets?: string }): Promise<string> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('custom_registers')
    .insert({
      user_id: userId,
      name: register.name,
      description: register.description,
      columns: register.columns as any,
      presets: register.presets || null
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

export const updateRegister = async (id: string, updates: Partial<{ name: string; description: string; columns: ColumnDef[] }>): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;

  const dbUpdates: any = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.columns !== undefined) dbUpdates.columns = updates.columns;

  const { error } = await supabase
    .from('custom_registers')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
};

export const deleteRegister = async (id: string): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('custom_registers')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
};

// ========== Register Rows CRUD ==========

export const getRegisterRows = async (registerId: string): Promise<CustomRegisterRow[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  const allData: any[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('custom_register_rows')
      .select('*')
      .eq('user_id', userId)
      .eq('register_id', registerId)
      .order('row_order', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData.map(r => ({
    id: r.id,
    register_id: r.register_id,
    row_data: (r.row_data as any) || {},
    row_order: r.row_order,
    created_at: r.created_at,
    updated_at: r.updated_at
  }));
};

export const addRegisterRow = async (registerId: string, rowData: Record<string, any>, rowOrder: number): Promise<string> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('custom_register_rows')
    .insert({
      user_id: userId,
      register_id: registerId,
      row_data: rowData as any,
      row_order: rowOrder
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

export const updateRegisterRow = async (id: string, rowData: Record<string, any>): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('custom_register_rows')
    .update({ row_data: rowData as any, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
};

export const deleteRegisterRow = async (id: string): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('custom_register_rows')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
};

export const bulkAddRegisterRows = async (registerId: string, rows: Record<string, any>[]): Promise<number> => {
  const userId = await getUserId();
  if (!userId) return 0;

  const existingRows = await getRegisterRows(registerId);
  let nextOrder = existingRows.length;

  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((rowData, idx) => ({
      user_id: userId,
      register_id: registerId,
      row_data: rowData as any,
      row_order: nextOrder + i + idx
    }));

    const { error } = await supabase
      .from('custom_register_rows')
      .insert(batch);

    if (error) throw error;
    inserted += batch.length;
  }

  return inserted;
};

export const clearRegisterRows = async (registerId: string): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('custom_register_rows')
    .delete()
    .eq('register_id', registerId)
    .eq('user_id', userId);

  if (error) throw error;
};

// ========== Preset Templates ==========

export const REGISTER_PRESETS: Record<string, { name: string; description: string; columns: ColumnDef[] }> = {
  'sb-26': {
    name: 'SB-26 Silent Accounts Register',
    description: 'Register of accounts with no transactions beyond threshold period',
    columns: [
      { key: 'sl_no', label: 'Sl. No.', type: 'number', required: true },
      { key: 'account_no', label: 'Account No.', type: 'text', required: true },
      { key: 'name', label: 'Name of Depositor', type: 'text', required: true },
      { key: 'scheme', label: 'Scheme Type', type: 'select', options: ['SB', 'RD', 'TD', 'MIS', 'SSA', 'PPF', 'SCSS', 'KVP', 'NSC'] },
      { key: 'balance', label: 'Balance (₹)', type: 'number' },
      { key: 'last_txn_date', label: 'Last Txn Date', type: 'date' },
      { key: 'silent_since', label: 'Silent Since', type: 'date' },
      { key: 'bo_name', label: 'BO/SO Name', type: 'text' },
      { key: 'action_taken', label: 'Action Taken', type: 'text' },
      { key: 'remarks', label: 'Remarks', type: 'text' }
    ]
  },
  'mail-despatch': {
    name: 'Mail Despatch Register',
    description: 'Track incoming and outgoing mail with references',
    columns: [
      { key: 'sl_no', label: 'Sl. No.', type: 'number', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'type', label: 'Type', type: 'select', options: ['Incoming', 'Outgoing'], required: true },
      { key: 'from_to', label: 'From/To', type: 'text', required: true },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'reference_no', label: 'Reference No.', type: 'text' },
      { key: 'action_taken', label: 'Action Taken', type: 'text' },
      { key: 'remarks', label: 'Remarks', type: 'text' }
    ]
  },
  'sb-45': {
    name: 'SB-45 Register',
    description: 'Register of withdrawals debited through BO',
    columns: [
      { key: 'sl_no', label: 'Sl. No.', type: 'number', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'account_no', label: 'Account No.', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'bo_name', label: 'BO Name', type: 'text' },
      { key: 'amount', label: 'Amount (₹)', type: 'number', required: true },
      { key: 'txn_id', label: 'Transaction ID', type: 'text' },
      { key: 'verification_status', label: 'Verification', type: 'select', options: ['Pending', 'Verified', 'Discrepancy'] },
      { key: 'remarks', label: 'Remarks', type: 'text' }
    ]
  },
  'error-book': {
    name: 'Special Error Book (Rule 60)',
    description: 'Post-March 31 transactions without interest',
    columns: [
      { key: 'sl_no', label: 'Sl. No.', type: 'number', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'account_no', label: 'Account No.', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'scheme', label: 'Scheme', type: 'text' },
      { key: 'error_type', label: 'Error Type', type: 'text' },
      { key: 'amount', label: 'Amount (₹)', type: 'number' },
      { key: 'corrective_action', label: 'Corrective Action', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Resolved', 'Escalated'] },
      { key: 'remarks', label: 'Remarks', type: 'text' }
    ]
  },
  'blank': {
    name: 'Blank Register',
    description: 'Start from scratch with your own columns',
    columns: [
      { key: 'sl_no', label: 'Sl. No.', type: 'number', required: true },
      { key: 'col1', label: 'Column 1', type: 'text' },
      { key: 'col2', label: 'Column 2', type: 'text' },
      { key: 'remarks', label: 'Remarks', type: 'text' }
    ]
  }
};
