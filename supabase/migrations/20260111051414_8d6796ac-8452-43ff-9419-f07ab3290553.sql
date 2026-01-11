-- Create tables for sensitive financial data storage

-- Memos table (verification records)
CREATE TABLE public.memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  serial INTEGER NOT NULL,
  memo_key TEXT NOT NULL,
  account TEXT NOT NULL,
  txn_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  txn_date DATE NOT NULL,
  name TEXT DEFAULT 'Unknown',
  address TEXT DEFAULT '',
  balance NUMERIC(12,2) DEFAULT 0,
  balance_date DATE,
  bo_code TEXT DEFAULT '',
  bo_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Pending', 'Verified', 'Reported')),
  printed BOOLEAN DEFAULT FALSE,
  memo_sent_date DATE,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_date DATE,
  verified_date DATE,
  reported_date DATE,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Last balance records table
CREATE TABLE public.last_balance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  balance NUMERIC(12,2) DEFAULT 0,
  balance_date DATE,
  bo_name TEXT DEFAULT '',
  scheme_type TEXT DEFAULT '',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Despatch records table
CREATE TABLE public.despatch_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_memo INTEGER NOT NULL,
  to_memo INTEGER NOT NULL,
  post_number TEXT NOT NULL,
  despatch_date DATE NOT NULL,
  memo_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HFTI transactions table
CREATE TABLE public.hfti_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  txn_date DATE NOT NULL,
  txn_id TEXT NOT NULL,
  account TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  debit_credit CHAR(1) NOT NULL CHECK (debit_credit IN ('D', 'C')),
  bo_reference TEXT DEFAULT '',
  particulars TEXT DEFAULT '',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_file TEXT DEFAULT ''
);

-- App settings table
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  last_serial INTEGER DEFAULT 0,
  threshold INTEGER DEFAULT 10000,
  group_by_bo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_balance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despatch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hfti_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for memos
CREATE POLICY "Users can view their own memos" ON public.memos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own memos" ON public.memos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own memos" ON public.memos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own memos" ON public.memos
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for last_balance_records
CREATE POLICY "Users can view their own balance records" ON public.last_balance_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own balance records" ON public.last_balance_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own balance records" ON public.last_balance_records
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own balance records" ON public.last_balance_records
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for despatch_records
CREATE POLICY "Users can view their own despatch records" ON public.despatch_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own despatch records" ON public.despatch_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own despatch records" ON public.despatch_records
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own despatch records" ON public.despatch_records
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for hfti_transactions
CREATE POLICY "Users can view their own HFTI transactions" ON public.hfti_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own HFTI transactions" ON public.hfti_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own HFTI transactions" ON public.hfti_transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own HFTI transactions" ON public.hfti_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for app_settings
CREATE POLICY "Users can view their own settings" ON public.app_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own settings" ON public.app_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.app_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own settings" ON public.app_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_memos_user_id ON public.memos(user_id);
CREATE INDEX idx_memos_status ON public.memos(status);
CREATE INDEX idx_memos_account ON public.memos(account);
CREATE INDEX idx_last_balance_user_id ON public.last_balance_records(user_id);
CREATE INDEX idx_last_balance_account ON public.last_balance_records(account);
CREATE INDEX idx_hfti_user_id ON public.hfti_transactions(user_id);
CREATE INDEX idx_hfti_txn_date ON public.hfti_transactions(txn_date);
CREATE INDEX idx_despatch_user_id ON public.despatch_records(user_id);

-- Unique constraints to prevent duplicates
CREATE UNIQUE INDEX idx_memos_unique ON public.memos(user_id, memo_key);
CREATE UNIQUE INDEX idx_hfti_unique ON public.hfti_transactions(user_id, txn_id, account, amount, txn_date);