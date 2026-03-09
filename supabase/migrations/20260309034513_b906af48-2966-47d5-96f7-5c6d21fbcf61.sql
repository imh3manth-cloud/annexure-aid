
-- Custom registers (format definitions)
CREATE TABLE public.custom_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  presets text DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.custom_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own registers" ON public.custom_registers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own registers" ON public.custom_registers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own registers" ON public.custom_registers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own registers" ON public.custom_registers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Custom register rows (data entries)
CREATE TABLE public.custom_register_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  register_id uuid NOT NULL REFERENCES public.custom_registers(id) ON DELETE CASCADE,
  row_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.custom_register_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own register rows" ON public.custom_register_rows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own register rows" ON public.custom_register_rows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own register rows" ON public.custom_register_rows FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own register rows" ON public.custom_register_rows FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_custom_register_rows_register ON public.custom_register_rows(register_id);
CREATE INDEX idx_custom_registers_user ON public.custom_registers(user_id);
