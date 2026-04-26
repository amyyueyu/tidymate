CREATE OR REPLACE FUNCTION public.get_active_users_stats()
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

  WITH activity AS (
    SELECT user_id, created_at::date AS activity_date FROM public.rooms
    UNION ALL
    SELECT user_id, completed_at::date FROM public.challenges
      WHERE status = 'completed' AND completed_at IS NOT NULL
    UNION ALL
    SELECT user_id, created_at::date FROM public.decision_sessions
    UNION ALL
    SELECT user_id, user_action_at::date FROM public.decision_items
      WHERE user_action_at IS NOT NULL
  ),
  user_activity AS (
    SELECT DISTINCT user_id, activity_date FROM activity
  ),
  daily_series AS (
    SELECT
      d::date AS date,
      (SELECT COUNT(DISTINCT ua.user_id)::int
         FROM user_activity ua
        WHERE ua.activity_date = d::date) AS dau,
      (SELECT COUNT(DISTINCT ua.user_id)::int
         FROM user_activity ua
        WHERE ua.activity_date BETWEEN d::date - 6 AND d::date) AS wau,
      (SELECT COUNT(DISTINCT ua.user_id)::int
         FROM user_activity ua
        WHERE ua.activity_date BETWEEN d::date - 29 AND d::date) AS mau
    FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day'::interval) d
  )
  SELECT json_build_object(
    'dau_today',
      (SELECT COUNT(DISTINCT user_id)::int FROM user_activity
        WHERE activity_date = CURRENT_DATE),
    'dau_yesterday',
      (SELECT COUNT(DISTINCT user_id)::int FROM user_activity
        WHERE activity_date = CURRENT_DATE - 1),
    'wau',
      (SELECT COUNT(DISTINCT user_id)::int FROM user_activity
        WHERE activity_date BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE),
    'wau_prev',
      (SELECT COUNT(DISTINCT user_id)::int FROM user_activity
        WHERE activity_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE - 7),
    'mau',
      (SELECT COUNT(DISTINCT user_id)::int FROM user_activity
        WHERE activity_date BETWEEN CURRENT_DATE - 29 AND CURRENT_DATE),
    'mau_prev',
      (SELECT COUNT(DISTINCT user_id)::int FROM user_activity
        WHERE activity_date BETWEEN CURRENT_DATE - 59 AND CURRENT_DATE - 30),
    'stickiness_dau_mau',
      ROUND(
        (SELECT COUNT(DISTINCT user_id)::numeric FROM user_activity WHERE activity_date = CURRENT_DATE) /
        NULLIF((SELECT COUNT(DISTINCT user_id) FROM user_activity
                 WHERE activity_date BETWEEN CURRENT_DATE - 29 AND CURRENT_DATE), 0) * 100, 1),
    'stickiness_wau_mau',
      ROUND(
        (SELECT COUNT(DISTINCT user_id)::numeric FROM user_activity
          WHERE activity_date BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE) /
        NULLIF((SELECT COUNT(DISTINCT user_id) FROM user_activity
                 WHERE activity_date BETWEEN CURRENT_DATE - 29 AND CURRENT_DATE), 0) * 100, 1),
    'daily_series',
      (SELECT json_agg(row_to_json(ds) ORDER BY ds.date) FROM daily_series ds)
  ) INTO result;

  RETURN result;
END;
$function$;