
-- ============================================================
-- 1. Fix storage.objects ownership policies for room-images
-- ============================================================

-- Drop overly-permissive existing DELETE/UPDATE policies if they exist
DROP POLICY IF EXISTS "Users can delete room images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update room images" ON storage.objects;

-- Ownership-scoped DELETE: only the folder owner (user id prefix) can delete
CREATE POLICY "Users can delete own room images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'room-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Ownership-scoped UPDATE: only the folder owner can update
CREATE POLICY "Users can update own room images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'room-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 2. Server-side points function (SECURITY DEFINER)
--    Atomically adds points from a completed challenge to the
--    owner's profile, preventing client-side score manipulation.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_challenge_add_points(p_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points  integer;
  v_user_id uuid;
BEGIN
  -- Verify the challenge belongs to the calling user
  SELECT points, user_id
    INTO v_points, v_user_id
    FROM public.challenges
   WHERE id = p_challenge_id
     AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found or access denied';
  END IF;

  -- Atomically increment points and recalculate level
  UPDATE public.profiles
     SET total_points  = total_points + v_points,
         current_level = GREATEST(1, floor((total_points + v_points) / 100)::int + 1),
         updated_at    = now()
   WHERE user_id = auth.uid();
END;
$$;
