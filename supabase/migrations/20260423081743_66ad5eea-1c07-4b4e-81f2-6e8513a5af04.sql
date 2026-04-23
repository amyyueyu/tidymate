-- Decision sessions: one per photo upload
CREATE TABLE public.decision_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'pile',
  item_count INTEGER NOT NULL DEFAULT 0,
  decisions_completed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.decision_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own decision sessions"
  ON public.decision_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own decision sessions"
  ON public.decision_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own decision sessions"
  ON public.decision_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Decision items: one row per detected item
CREATE TABLE public.decision_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.decision_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  visual_description TEXT,
  category TEXT,
  ai_suggested_action TEXT NOT NULL,
  ai_rationale TEXT,
  confidence NUMERIC,
  user_action TEXT,
  user_action_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own decision items"
  ON public.decision_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own decision items"
  ON public.decision_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own decision items"
  ON public.decision_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_decision_items_session ON public.decision_items(session_id);
CREATE INDEX idx_decision_sessions_user ON public.decision_sessions(user_id, created_at DESC);

-- Points RPC: award points for a completed decision
CREATE OR REPLACE FUNCTION public.complete_decision_add_points(
  p_item_id uuid,
  p_user_action text,
  p_accepted_ai boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_session_id uuid;
  v_points integer;
  v_profile profiles%ROWTYPE;
  v_today date;
  v_last_activity date;
  v_new_streak integer;
  v_new_longest integer;
  v_new_points integer;
  v_new_level integer;
BEGIN
  -- Verify ownership
  SELECT user_id, session_id INTO v_user_id, v_session_id
  FROM public.decision_items
  WHERE id = p_item_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decision item not found or access denied';
  END IF;

  -- Award 5 base + 2 bonus if AI suggestion was accepted
  v_points := 5 + CASE WHEN p_accepted_ai THEN 2 ELSE 0 END;

  -- Mark item done
  UPDATE public.decision_items
  SET user_action = p_user_action,
      user_action_at = now(),
      status = 'done'
  WHERE id = p_item_id AND user_id = auth.uid();

  -- Increment session counter
  UPDATE public.decision_sessions
  SET decisions_completed = decisions_completed + 1
  WHERE id = v_session_id AND user_id = auth.uid();

  -- Update profile points + streak
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id;

  v_today := (now() AT TIME ZONE 'UTC')::date;
  v_last_activity := v_profile.last_activity_date;

  IF v_last_activity IS NULL THEN
    v_new_streak := 1;
  ELSIF v_today = v_last_activity THEN
    v_new_streak := GREATEST(v_profile.current_streak, 1);
  ELSIF v_today = v_last_activity + 1 THEN
    v_new_streak := v_profile.current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  v_new_points  := v_profile.total_points + v_points;
  v_new_level   := GREATEST(1, (v_new_points / 100) + 1);
  v_new_longest := GREATEST(v_profile.longest_streak, v_new_streak);

  UPDATE public.profiles
  SET total_points = v_new_points,
      current_level = v_new_level,
      current_streak = v_new_streak,
      longest_streak = v_new_longest,
      last_activity_date = v_today,
      updated_at = now()
  WHERE user_id = v_user_id;
END;
$$;