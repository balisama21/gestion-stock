-- Marque blanche : un domaine → une boutique → une identité visuelle.
--
-- Purement additif : deux tables neuves, trois fonctions neuves. Aucune
-- table existante n'est touchée ; le code déjà en service l'ignore.
--
-- Écriture : réservée au super admin (profiles.is_platform_admin).
-- Lecture privée : membres de la boutique concernée.
-- Lecture publique (anon, avant connexion) : uniquement via
-- get_public_branding(hostname), qui ne rend ni store_id ni la liste
-- des domaines.

-- ─── Super admin ─────────────────────────────────────────────────────
-- Alias explicite de l'administrateur unique de la plateforme.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ─── Normalisation d'un nom d'hôte ───────────────────────────────────
-- « WWW.Kinvest.mg:443. » → « kinvest.mg »
CREATE OR REPLACE FUNCTION public.normaliser_hote(p_hote text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(lower(btrim(COALESCE(p_hote, ''))), ':[0-9]+$', ''),
           '\.$', ''),
         '^www\.', '');
$$;

GRANT EXECUTE ON FUNCTION public.normaliser_hote(text) TO anon, authenticated;

-- ─── Identité visuelle d'une boutique ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.branding (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  app_name              text NOT NULL CHECK (char_length(app_name) BETWEEN 1 AND 60),
  short_name            text CHECK (short_name IS NULL OR char_length(short_name) BETWEEN 1 AND 20),
  tagline               text CHECK (tagline IS NULL OR char_length(tagline) <= 160),
  page_title            text CHECK (page_title IS NULL OR char_length(page_title) <= 120),
  logo_url              text,
  favicon_url           text,
  splash_logo_url       text,
  login_image_url       text,
  login_title           text CHECK (login_title IS NULL OR char_length(login_title) <= 80),
  login_subtitle        text CHECK (login_subtitle IS NULL OR char_length(login_subtitle) <= 200),
  primary_color         text CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  primary_color_dark    text CHECK (primary_color_dark IS NULL OR primary_color_dark ~ '^#[0-9A-Fa-f]{6}$'),
  splash_background     text CHECK (splash_background IS NULL OR splash_background ~ '^#[0-9A-Fa-f]{6}$'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- URL absolue https ou chemin local, sans caractère capable de sortir
  -- d'un url("…") CSS ou d'un attribut HTML.
  CONSTRAINT branding_urls_sures CHECK (
        (logo_url        IS NULL OR logo_url        ~ '^(https://|/)[^"''\\\s()<>]+$')
    AND (favicon_url     IS NULL OR favicon_url     ~ '^(https://|/)[^"''\\\s()<>]+$')
    AND (splash_logo_url IS NULL OR splash_logo_url ~ '^(https://|/)[^"''\\\s()<>]+$')
    AND (login_image_url IS NULL OR login_image_url ~ '^(https://|/)[^"''\\\s()<>]+$')
  )
);

DROP TRIGGER IF EXISTS branding_updated_at ON public.branding;
CREATE TRIGGER branding_updated_at
  BEFORE UPDATE ON public.branding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Domaines personnalisés ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_domains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname    text NOT NULL UNIQUE,
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Stocké déjà normalisé : minuscules, sans port, sans « www. ».
  CONSTRAINT custom_domains_hote_normalise CHECK (hostname = public.normaliser_hote(hostname)),
  CONSTRAINT custom_domains_hote_valide CHECK (
    hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  )
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_store ON public.custom_domains(store_id);

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.branding       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.branding, public.custom_domains FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branding, public.custom_domains TO authenticated;

DROP POLICY IF EXISTS branding_lecture ON public.branding;
CREATE POLICY branding_lecture ON public.branding
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin()) OR public.is_store_member(store_id));

DROP POLICY IF EXISTS branding_ajout ON public.branding;
CREATE POLICY branding_ajout ON public.branding
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS branding_modification ON public.branding;
CREATE POLICY branding_modification ON public.branding
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS branding_suppression ON public.branding;
CREATE POLICY branding_suppression ON public.branding
  FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS custom_domains_lecture ON public.custom_domains;
CREATE POLICY custom_domains_lecture ON public.custom_domains
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin()) OR public.is_store_member(store_id));

DROP POLICY IF EXISTS custom_domains_ajout ON public.custom_domains;
CREATE POLICY custom_domains_ajout ON public.custom_domains
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS custom_domains_modification ON public.custom_domains;
CREATE POLICY custom_domains_modification ON public.custom_domains
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS custom_domains_suppression ON public.custom_domains;
CREATE POLICY custom_domains_suppression ON public.custom_domains
  FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

-- ─── Lecture publique, avant connexion ───────────────────────────────
-- Un seul hôte en entrée, au plus une ligne en sortie, champs publics
-- seulement. Impossible d'énumérer les domaines ou de remonter au store.
CREATE OR REPLACE FUNCTION public.get_public_branding(p_hostname text)
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
  splash_background  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.app_name, b.short_name, b.tagline, b.page_title,
         b.logo_url, b.favicon_url, b.splash_logo_url, b.login_image_url,
         b.login_title, b.login_subtitle,
         b.primary_color, b.primary_color_dark, b.splash_background
    FROM public.custom_domains d
    JOIN public.branding b ON b.store_id = d.store_id
   WHERE d.hostname = public.normaliser_hote(p_hostname)
     AND d.is_active
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_branding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_branding(text) TO anon, authenticated;
