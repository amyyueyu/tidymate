-- Add wip_image_url column to rooms table
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS wip_image_url TEXT;

-- Add add_progress_photo_points RPC function
CREATE OR REPLACE FUNCTION public.add_progress_photo_points(p_room_id uuid, p_points integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.rooms WHERE id = p_room_id;
  IF v_user_id IS NULL THEN RETURN; END IF;
  IF v_user_id != auth.uid() THEN RETURN; END IF;
  UPDATE public.profiles
    SET total_points = total_points + p_points,
        current_level = GREATEST(1, floor((total_points + p_points) / 100)::int + 1),
        updated_at = now()
    WHERE user_id = v_user_id;
END;
$$;