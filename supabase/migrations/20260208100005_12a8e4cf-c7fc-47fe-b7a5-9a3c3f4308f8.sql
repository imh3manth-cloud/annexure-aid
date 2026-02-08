
-- Backfill reminder_history from existing memos with reminder_count > 0
-- For each memo, create one history entry per reminder (1 through reminder_count)
INSERT INTO public.reminder_history (user_id, memo_id, reminder_number, reminder_date, status)
SELECT 
  m.user_id,
  m.id,
  generate_series(1, m.reminder_count),
  COALESCE(m.last_reminder_date, m.memo_sent_date, m.txn_date),
  'Active'
FROM public.memos m
WHERE m.reminder_count > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.reminder_history rh WHERE rh.memo_id = m.id
  );
