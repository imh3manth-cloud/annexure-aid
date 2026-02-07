
-- Create reminder_history table to track individual reminders
CREATE TABLE public.reminder_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  memo_id UUID NOT NULL REFERENCES public.memos(id) ON DELETE CASCADE,
  reminder_number INTEGER NOT NULL,
  reminder_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminder_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminder history"
  ON public.reminder_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminder history"
  ON public.reminder_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminder history"
  ON public.reminder_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminder history"
  ON public.reminder_history FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_reminder_history_memo_id ON public.reminder_history(memo_id);
CREATE INDEX idx_reminder_history_user_id ON public.reminder_history(user_id);
