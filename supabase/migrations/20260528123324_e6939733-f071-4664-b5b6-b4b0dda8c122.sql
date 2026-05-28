
CREATE OR REPLACE FUNCTION public.verify_admin_password(p text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_settings
    WHERE key = 'admin_pass_hash'
      AND value = crypt(p, value)
  );
$$;

REVOKE ALL ON FUNCTION public.verify_admin_password(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_password(text) TO service_role;
