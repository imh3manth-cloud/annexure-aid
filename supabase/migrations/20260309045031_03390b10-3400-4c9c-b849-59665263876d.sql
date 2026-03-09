ALTER TABLE public.memos ADD CONSTRAINT memos_user_serial_unique UNIQUE (user_id, serial);
ALTER TABLE public.memos ADD CONSTRAINT memos_user_memo_key_unique UNIQUE (user_id, memo_key);