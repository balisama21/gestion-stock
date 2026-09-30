-- Marque blanche : page d'accueil propre à chaque marque cliente.
--
-- Additif : une colonne facultative. Sans contenu, le domaine client
-- garde sa page de connexion seule. Le texte est rendu par React
-- (échappé) ; la forme est vérifiée côté client (`landingDepuisJson`).

ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS landing jsonb
  CHECK (landing IS NULL OR jsonb_typeof(landing) = 'object');

-- Le type de retour change : DROP puis CREATE, dans la même transaction.
-- Les clients déjà chargés ignorent la colonne en plus.
DROP FUNCTION IF EXISTS public.get_public_branding(text);

CREATE FUNCTION public.get_public_branding(p_hostname text)
RETURNS TABLE (
  app_name           text,
  short_name         text,
  tagline            text,
  page_title         text,
  logo_url           text,
  favicon_url        text,
  splash_logo_url    text,
  login_image_url    text,
  login_title        text,
  login_subtitle     text,
  primary_color      text,
  primary_color_dark text,
  splash_background  text,
  landing            jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.app_name, b.short_name, b.tagline, b.page_title,
         b.logo_url, b.favicon_url, b.splash_logo_url, b.login_image_url,
         b.login_title, b.login_subtitle,
         b.primary_color, b.primary_color_dark, b.splash_background,
         b.landing
    FROM public.custom_domains d
    JOIN public.branding b ON b.store_id = d.store_id
   WHERE d.hostname = public.normaliser_hote(p_hostname)
     AND d.is_active
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_branding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_branding(text) TO anon, authenticated;
