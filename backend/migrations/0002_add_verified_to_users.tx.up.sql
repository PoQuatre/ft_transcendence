SET statement_timeout = 0;
ALTER TABLE public.users ADD COLUMN verified boolean DEFAULT false;
