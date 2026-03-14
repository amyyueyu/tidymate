-- Step 1: Replace complete_challenge_add_points with correct calendar-date streak logic
CREATE OR REPLACE FUNCTION public.complete_challenge_add_points(p_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_points integer;
  v_room_id uuid;
  v_profile profiles%ROWTYPE;
  v_today date;
  v_last_activity date;
  v_new_streak integer;
  v_new_points integer;
  v_new_level integer;
BEGIN
  SELECT user_id, points, room_id
  INTO v_user_id, v_points, v_room_id
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Challenge not found: %', p_challenge_id;
  END IF;

  UPDATE public.challenges
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_challenge_id;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id;

  v_today := CURRENT_DATE;
  v_last_activity := v_profile.last_activity_date::date;

  IF v_last_activity IS NULL THEN
    v_new_streak := 1;
  ELSIF v_today = v_last_activity THEN
    v_new_streak := GREATEST(v_profile.current_streak, 1);
  ELSIF v_today = v_last_activity + 1 THEN
    v_new_streak := v_profile.current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  v_new_points := v_profile.total_points + v_points;
  v_new_level  := GREATEST(1, (v_new_points / 100) + 1);

  UPDATE public.profiles
  SET total_points       = v_new_points,
      current_level      = v_new_level,
      current_streak     = v_new_streak,
      longest_streak     = GREATEST(v_profile.longest_streak, v_new_streak),
      last_activity_date = now(),
      updated_at         = now()
  WHERE user_id = v_user_id;
END;
$$;

-- Step 2: Repair profiles where points > 0 but streak stuck at 0
UPDATE public.profiles
SET last_activity_date = (
  SELECT MAX(completed_at)
  FROM public.challenges
  WHERE challenges.user_id = profiles.user_id
    AND challenges.status = 'completed'
),
current_streak = CASE
  WHEN (
    SELECT MAX(completed_at)::date
    FROM public.challenges
    WHERE challenges.user_id = profiles.user_id
      AND challenges.status = 'completed'
  ) = CURRENT_DATE THEN 1
  WHEN (
    SELECT MAX(completed_at)::date
    FROM public.challenges
    WHERE challenges.user_id = profiles.user_id
      AND challenges.status = 'completed'
  ) = CURRENT_DATE - 1 THEN 1
  ELSE 0
END
WHERE current_streak = 0
  AND total_points > 0;