CREATE OR REPLACE FUNCTION public.get_premium_stats()
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

  SELECT json_build_object(
    -- Sessions (= users who uploaded a photo to analyze)
    'total_sessions',
      (SELECT COUNT(*)::int FROM decision_sessions),
    'sessions_7d',
      (SELECT COUNT(*)::int FROM decision_sessions WHERE created_at >= now() - interval '7 days'),
    'sessions_30d',
      (SELECT COUNT(*)::int FROM decision_sessions WHERE created_at >= now() - interval '30 days'),
    'unique_users_uploaded',
      (SELECT COUNT(DISTINCT user_id)::int FROM decision_sessions),
    'sessions_by_intent',
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT intent, COUNT(*)::int as count FROM decision_sessions GROUP BY intent ORDER BY count DESC
      ) t),

    -- Completion
    'sessions_completed',
      (SELECT COUNT(*)::int FROM decision_sessions WHERE status = 'completed'),
    'sessions_completion_rate',
      ROUND(
        (SELECT COUNT(*) FROM decision_sessions WHERE status = 'completed')::numeric /
        NULLIF((SELECT COUNT(*) FROM decision_sessions), 0) * 100, 1
      ),
    'avg_items_per_session',
      ROUND(
        (SELECT COALESCE(AVG(item_count), 0) FROM decision_sessions WHERE item_count > 0)::numeric, 1
      ),

    -- Items
    'total_items_detected',
      (SELECT COUNT(*)::int FROM decision_items),
    'items_decided',
      (SELECT COUNT(*)::int FROM decision_items WHERE status = 'done'),
    'items_skipped',
      (SELECT COUNT(*)::int FROM decision_items WHERE status = 'skipped'),
    'item_decision_rate',
      ROUND(
        (SELECT COUNT(*) FROM decision_items WHERE status = 'done')::numeric /
        NULLIF((SELECT COUNT(*) FROM decision_items), 0) * 100, 1
      ),

    -- AI feedback loop: accepted vs overridden
    'ai_accepted_count',
      (SELECT COUNT(*)::int FROM decision_items
       WHERE status = 'done' AND user_action IS NOT NULL AND user_action = ai_suggested_action),
    'ai_overridden_count',
      (SELECT COUNT(*)::int FROM decision_items
       WHERE status = 'done' AND user_action IS NOT NULL AND user_action <> ai_suggested_action),
    'ai_acceptance_rate',
      ROUND(
        (SELECT COUNT(*) FROM decision_items
         WHERE status = 'done' AND user_action IS NOT NULL AND user_action = ai_suggested_action)::numeric /
        NULLIF((SELECT COUNT(*) FROM decision_items WHERE status = 'done' AND user_action IS NOT NULL), 0) * 100, 1
      ),

    -- AI suggestion distribution (what AI tends to recommend)
    'ai_action_distribution',
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT ai_suggested_action as action, COUNT(*)::int as count
        FROM decision_items
        GROUP BY ai_suggested_action
        ORDER BY count DESC
      ) t),

    -- User action distribution (what users actually decided)
    'user_action_distribution',
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT user_action as action, COUNT(*)::int as count
        FROM decision_items
        WHERE user_action IS NOT NULL
        GROUP BY user_action
        ORDER BY count DESC
      ) t),

    -- Confidence stats
    'avg_ai_confidence',
      ROUND((SELECT COALESCE(AVG(confidence), 0) FROM decision_items)::numeric, 2),

    -- Repeat usage
    'users_with_multiple_sessions',
      (SELECT COUNT(*)::int FROM (
        SELECT user_id FROM decision_sessions GROUP BY user_id HAVING COUNT(*) > 1
      ) t),

    -- Per-category override patterns (top 5 categories with most overrides)
    'top_overridden_categories',
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          COALESCE(category, 'uncategorized') as category,
          COUNT(*)::int as overrides
        FROM decision_items
        WHERE status = 'done'
          AND user_action IS NOT NULL
          AND user_action <> ai_suggested_action
        GROUP BY category
        ORDER BY overrides DESC
        LIMIT 5
      ) t)
  ) INTO result;
  RETURN result;
END;
$function$;