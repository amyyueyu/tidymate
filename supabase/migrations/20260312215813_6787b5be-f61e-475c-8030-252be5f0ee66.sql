
-- Rate limiting table for edge function abuse prevention
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  call_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_key_idx ON public.rate_limits (key);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER function so edge functions can call it without service role key
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key text,
  p_max_calls integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamp with time zone;
BEGIN
  SELECT call_count, window_start
    INTO v_count, v_window_start
    FROM public.rate_limits
   WHERE key = p_key
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (key, call_count, window_start)
    VALUES (p_key, 1, now());
    RETURN true;
  END IF;

  IF v_window_start + (p_window_seconds || ' seconds')::interval > now() THEN
    IF v_count >= p_max_calls THEN
      RETURN false;
    END IF;
    UPDATE public.rate_limits
       SET call_count = call_count + 1
     WHERE key = p_key;
    RETURN true;
  ELSE
    UPDATE public.rate_limits
       SET call_count = 1,
           window_start = now()
     WHERE key = p_key;
    RETURN true;
  END IF;
END;
$$;
