CREATE OR REPLACE FUNCTION public.get_retention_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH
  -- All user activity events (signup + any meaningful action)
  activity AS (
    SELECT user_id, created_at::date AS activity_date FROM public.rooms
    UNION ALL
    SELECT user_id, completed_at::date FROM public.challenges WHERE status = 'completed' AND completed_at IS NOT NULL
    UNION ALL
    SELECT user_id, created_at::date FROM public.decision_sessions
    UNION ALL
    SELECT user_id, user_action_at::date FROM public.decision_items WHERE user_action_at IS NOT NULL
  ),
  user_activity AS (
    SELECT DISTINCT user_id, activity_date FROM activity
  ),
  -- Each user's signup date (cohort)
  cohorts AS (
    SELECT user_id, created_at::date AS signup_date FROM public.profiles
  ),
  -- For each user, did they come back N days after signup (in a +/-1 day window)?
  retention_flags AS (
    SELECT
      c.user_id,
      c.signup_date,
      EXISTS (SELECT 1 FROM user_activity ua WHERE ua.user_id = c.user_id AND ua.activity_date BETWEEN c.signup_date + 1 AND c.signup_date + 1) AS d1,
      EXISTS (SELECT 1 FROM user_activity ua WHERE ua.user_id = c.user_id AND ua.activity_date BETWEEN c.signup_date + 1 AND c.signup_date + 7) AS d7,
      EXISTS (SELECT 1 FROM user_activity ua WHERE ua.user_id = c.user_id AND ua.activity_date BETWEEN c.signup_date + 1 AND c.signup_date + 30) AS d30,
      EXISTS (SELECT 1 FROM user_activity ua WHERE ua.user_id = c.user_id AND ua.activity_date BETWEEN c.signup_date + 1 AND c.signup_date + 90) AS d90
    FROM cohorts c
  ),
  -- Eligible cohorts: only count users who had time to return
  eligible AS (
    SELECT
      COUNT(*) FILTER (WHERE signup_date <= CURRENT_DATE - 1)  AS eligible_d1,
      COUNT(*) FILTER (WHERE signup_date <= CURRENT_DATE - 7)  AS eligible_d7,
      COUNT(*) FILTER (WHERE signup_date <= CURRENT_DATE - 30) AS eligible_d30,
      COUNT(*) FILTER (WHERE signup_date <= CURRENT_DATE - 90) AS eligible_d90,
      COUNT(*) FILTER (WHERE d1  AND signup_date <= CURRENT_DATE - 1)  AS retained_d1,
      COUNT(*) FILTER (WHERE d7  AND signup_date <= CURRENT_DATE - 7)  AS retained_d7,
      COUNT(*) FILTER (WHERE d30 AND signup_date <= CURRENT_DATE - 30) AS retained_d30,
      COUNT(*) FILTER (WHERE d90 AND signup_date <= CURRENT_DATE - 90) AS retained_d90
    FROM retention_flags
  ),
  -- Per-cohort daily series (last 30 cohort days, all users w/ enough time for D1)
  daily_cohorts AS (
    SELECT
      d::date AS cohort_date,
      (SELECT COUNT(*) FROM cohorts c WHERE c.signup_date = d::date)::int AS cohort_size,
      (SELECT COUNT(*) FROM retention_flags rf WHERE rf.signup_date = d::date AND rf.d1)::int AS d1_returned,
      (SELECT COUNT(*) FROM retention_flags rf WHERE rf.signup_date = d::date AND rf.d7 AND d::date <= CURRENT_DATE - 7)::int AS d7_returned,
      (SELECT COUNT(*) FROM retention_flags rf WHERE rf.signup_date = d::date AND rf.d30 AND d::date <= CURRENT_DATE - 30)::int AS d30_returned
    FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE - 1, '1 day'::interval) d
  )
  SELECT json_build_object(
    'eligible_d1',  e.eligible_d1,
    'eligible_d7',  e.eligible_d7,
    'eligible_d30', e.eligible_d30,
    'eligible_d90', e.eligible_d90,
    'retained_d1',  e.retained_d1,
    'retained_d7',  e.retained_d7,
    'retained_d30', e.retained_d30,
    'retained_d90', e.retained_d90,
    'rate_d1',  ROUND(e.retained_d1::numeric  / NULLIF(e.eligible_d1, 0)  * 100, 1),
    'rate_d7',  ROUND(e.retained_d7::numeric  / NULLIF(e.eligible_d7, 0)  * 100, 1),
    'rate_d30', ROUND(e.retained_d30::numeric / NULLIF(e.eligible_d30, 0) * 100, 1),
    'rate_d90', ROUND(e.retained_d90::numeric / NULLIF(e.eligible_d90, 0) * 100, 1),
    'daily_cohorts', (SELECT json_agg(row_to_json(dc) ORDER BY dc.cohort_date) FROM daily_cohorts dc)
  )
  INTO result
  FROM eligible e;

  RETURN result;
END;
$function$;