
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_users',              (SELECT COUNT(*)::int FROM public.profiles),
    'users_uploaded',           (SELECT COUNT(DISTINCT user_id)::int FROM public.rooms),
    'users_completed_task',     (SELECT COUNT(DISTINCT user_id)::int FROM public.challenges WHERE status = 'completed'),
    'users_finished_room',      (SELECT COUNT(DISTINCT user_id)::int FROM public.rooms WHERE status = 'completed'),
    'total_uploads',            (SELECT COUNT(*)::int FROM public.rooms),
    'total_challenges',         (SELECT COUNT(*)::int FROM public.challenges),
    'total_completed_challenges',(SELECT COUNT(*)::int FROM public.challenges WHERE status = 'completed'),
    'total_completed_rooms',    (SELECT COUNT(*)::int FROM public.rooms WHERE status = 'completed'),
    'uploads_last_7d',          (SELECT COUNT(*)::int FROM public.rooms WHERE created_at >= now() - interval '7 days'),
    'completions_last_7d',      (SELECT COUNT(*)::int FROM public.challenges WHERE status = 'completed' AND completed_at >= now() - interval '7 days')
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_activity(p_days int DEFAULT 14)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'uploads', (
      SELECT json_agg(row_to_json(r)) FROM (
        SELECT created_at FROM public.rooms
        WHERE created_at >= now() - (p_days || ' days')::interval
      ) r
    ),
    'completions', (
      SELECT json_agg(row_to_json(r)) FROM (
        SELECT completed_at FROM public.challenges
        WHERE status = 'completed'
          AND completed_at >= now() - (p_days || ' days')::interval
      ) r
    )
  ) INTO result;
  RETURN result;
END;
$$;
